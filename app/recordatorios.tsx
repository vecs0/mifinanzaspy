/**
 * recordatorios.tsx
 * Responsabilidad: Gestión de recordatorios de pago
 * Usado por: expo-router
 * Depende de: reminders
 */
import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Path, Circle } from 'react-native-svg';
import { useThemeCtx } from '@/services/ThemeContext';
import { colors, colorsDark, borderRadius as br } from '@/theme/design-system';
import { getRecordatorios, insertRecordatorio, deleteRecordatorio, toggleRecordatorio, type Recordatorio } from '@/services/reminders';

const COL_URGENT = '#e07060';

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function fechaLabel(dateStr: string): string {
  const d = daysUntil(dateStr);
  if (d < 0) return `Venció el ${new Date(dateStr).toLocaleDateString('es-PY', { day: 'numeric', month: 'short' })}`;
  if (d === 0) return 'Vence hoy';
  if (d === 1) return 'Vence mañana';
  return `Vence en ${d} días · ${new Date(dateStr).toLocaleDateString('es-PY', { day: 'numeric', month: 'short' })}`;
}

function useStyles(t: typeof colors, dark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    hdr: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4,
    },
    backTxt: { fontSize: 15, fontWeight: '600', color: t.accent },
    titleBlock: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 6 },
    title: { fontSize: 24, fontWeight: '700', color: t.ink },
    secLabel: {
      fontSize: 10, fontWeight: '600', color: t.ink3,
      letterSpacing: 0.08, textTransform: 'uppercase',
      paddingHorizontal: 20, paddingBottom: 10,
    },
    emptyBox: {
      margin: 16, marginTop: 20,
      padding: 30,
      borderWidth: 1.5, borderColor: t.hairline, borderStyle: 'dashed',
      borderRadius: 16,
      alignItems: 'center', gap: 10,
    },
    emptyTxt: { fontSize: 13, color: t.ink3, textAlign: 'center', lineHeight: 20 },
    card: {
      marginHorizontal: 16, marginBottom: 10,
      backgroundColor: dark ? '#181816' : t.card,
      borderRadius: 14,
      borderWidth: 0.5, borderColor: t.hairline,
      borderLeftWidth: 3, borderLeftColor: t.accent,
      padding: 14, paddingLeft: 15,
    },
    cardUrgent: {
      borderLeftColor: COL_URGENT,
    },
    cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
    cardName: { fontSize: 14, fontWeight: '600', color: t.ink },
    cardAmt: { fontSize: 14, fontWeight: '700', color: t.accent, fontFamily: 'GeistMono' },
    cardAmtUrgent: { color: COL_URGENT },
    cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    cardMetaTxt: { fontSize: 11, color: t.ink3 },
    urgentTag: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      marginTop: 8, alignSelf: 'flex-start',
      paddingVertical: 3, paddingHorizontal: 8,
      borderRadius: 6,
      backgroundColor: dark ? '#2a1208' : '#ffe0d8',
    },
    urgentTagTxt: { fontSize: 10, fontWeight: '700', color: COL_URGENT },
    deleteBtn: { paddingTop: 10, alignSelf: 'flex-start' },
    deleteBtnTxt: { fontSize: 12, color: t.negative, fontWeight: '600' },
    addBtn: {
      marginHorizontal: 16, marginBottom: 24, marginTop: 8,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      paddingVertical: 13,
      backgroundColor: dark ? '#181816' : t.card,
      borderRadius: 12,
      borderWidth: 0.5, borderColor: t.hairline,
    },
    addBtnTxt: { fontSize: 14, fontWeight: '600', color: t.accent },
    label: { fontSize: 11, fontWeight: '600', color: t.ink3, textTransform: 'uppercase', letterSpacing: 0.5 },
    input: {
      borderWidth: 1, borderColor: t.hairline, borderRadius: br.sm,
      padding: 10, fontSize: 13, color: t.ink, backgroundColor: t.bg, marginTop: 4,
    },
    radio: {
      paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
      borderWidth: 1, borderColor: t.hairline,
    },
    radioActive: { backgroundColor: t.accent, borderColor: t.accent },
    radioLbl: { fontSize: 12, color: t.ink },
    radioLblActive: { color: '#fff' },
  });
}

function CalendarIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 9h18M9 3v4m6-4v4" />
      <Path d="M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
    </Svg>
  );
}

function SmallCalIcon({ color }: { color: string }) {
  return (
    <Svg width={12} height={12} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 9h18M9 3v4m6-4v4" />
      <Path d="M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
    </Svg>
  );
}

function AlertTriangleIcon({ color }: { color: string }) {
  return (
    <Svg width={11} height={11} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <Path d="M12 9v4M12 17h.01" />
    </Svg>
  );
}

function PlusIcon({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

function ConfirmModal({ visible, titulo, onCancel, onConfirm }: {
  visible: boolean; titulo: string; onCancel: () => void; onConfirm: () => void;
}) {
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' }}>
        <TouchableOpacity style={{ flex: 1 }} onPress={onCancel} />
        <View style={{
          backgroundColor: dark ? '#1E1A17' : '#FFFFFF',
          borderTopLeftRadius: br.xl, borderTopRightRadius: br.xl,
          paddingTop: 24, paddingHorizontal: 22, paddingBottom: 36, gap: 16,
        }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: t.hairline, alignSelf: 'center', marginBottom: 4 }} />
          <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: `${t.negative}18`, alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={t.negative} strokeWidth={1.8} strokeLinecap="round">
              <Path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
            </Svg>
          </View>
          <Text style={{ fontSize: 17, fontWeight: '700', color: t.ink }}>Eliminar recordatorio</Text>
          <Text style={{ fontSize: 13.5, color: t.ink3, lineHeight: 20 }}>
            Se eliminará "{titulo}" y su notificación programada.
          </Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
            <TouchableOpacity style={{
              flex: 1, paddingVertical: 14, borderRadius: br.md,
              backgroundColor: t.hairline, alignItems: 'center',
            }} onPress={onCancel} activeOpacity={0.7}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: t.ink }}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{
              flex: 1, paddingVertical: 14, borderRadius: br.md,
              backgroundColor: t.negative, alignItems: 'center',
            }} onPress={onConfirm} activeOpacity={0.7}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>Eliminar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function RecordatoriosScreen() {
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;
  const s = useStyles(t, dark);

  const [recordatorios, setRecordatorios] = useState<Recordatorio[]>([]);
  const [cargando, setCargando] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);

  const [titulo, setTitulo] = useState('');
  const [fecha, setFecha] = useState('');
  const [monto, setMonto] = useState('');
  const [repetir, setRepetir] = useState<Recordatorio['repetir']>('no');

  function cargar() {
    setCargando(true);
    const r = getRecordatorios();
    setRecordatorios(r);
    setCargando(false);
  }

  useEffect(() => { cargar(); }, []);

  function guardar() {
    if (!titulo.trim() || !fecha) return;
    insertRecordatorio({
      titulo: titulo.trim(),
      descripcion: '',
      fecha,
      repetir,
      activo: true,
      categoriaId: '',
      montoEstimado: parseInt(monto.replace(/\D/g, ''), 10) || 0,
    });
    setShowForm(false);
    setTitulo('');
    setFecha('');
    setMonto('');
    setRepetir('no');
    cargar();
  }

  function confirmarEliminar(id: string) {
    setConfirmandoId(id);
  }

  function ejecutarEliminar() {
    if (!confirmandoId) return;
    deleteRecordatorio(confirmandoId);
    setConfirmandoId(null);
    cargar();
  }

  const recordatorioConfirmando = recordatorios.find(r => r.id === confirmandoId);

  return (
    <SafeAreaView style={s.container}>
      <View style={s.hdr}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}
        >
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none"
            stroke={t.accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M15 18l-6-6 6-6" />
          </Svg>
          <Text style={s.backTxt}>Ajustes</Text>
        </TouchableOpacity>
      </View>

      <View style={s.titleBlock}>
        <Text style={s.title}>Recordatorios</Text>
      </View>

      {cargando ? (
        <ActivityIndicator color={t.accent} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          <Text style={s.secLabel}>
            Pagos pendientes{recordatorios.length > 0 ? ` · ${recordatorios.length}` : ''}
          </Text>

          {recordatorios.length === 0 && !showForm && (
            <View style={s.emptyBox}>
              <CalendarIcon color={t.ink3} />
              <Text style={s.emptyTxt}>
                No hay recordatorios.{'\n'}Agregá vencimientos de ANDE, ESSAP, tarjetas y más.
              </Text>
            </View>
          )}

          {recordatorios.map(r => {
            const days = daysUntil(r.fecha);
            const urgent = days <= 1;
            return (
              <View key={r.id} style={[s.card, urgent && s.cardUrgent]}>
                <View style={s.cardTop}>
                  <Text style={s.cardName}>{r.titulo}</Text>
                  {r.montoEstimado > 0 && (
                    <Text style={[s.cardAmt, urgent && s.cardAmtUrgent]}>
                      Gs {r.montoEstimado.toLocaleString('es-PY').replace(/,/g, '.')}
                    </Text>
                  )}
                </View>
                <View style={s.cardMeta}>
                  <SmallCalIcon color={t.ink3} />
                  <Text style={s.cardMetaTxt}>{fechaLabel(r.fecha)}</Text>
                </View>
                {urgent && (
                  <View style={s.urgentTag}>
                    <AlertTriangleIcon color={COL_URGENT} />
                    <Text style={s.urgentTagTxt}>Urgente</Text>
                  </View>
                )}
                <TouchableOpacity style={s.deleteBtn} onPress={() => confirmarEliminar(r.id)} activeOpacity={0.7}>
                  <Text style={s.deleteBtnTxt}>Eliminar</Text>
                </TouchableOpacity>
              </View>
            );
          })}

          {showForm && (
            <View style={{
              marginHorizontal: 16, marginBottom: 12,
              backgroundColor: dark ? '#181816' : t.card,
              borderRadius: 14, borderWidth: 1, borderColor: t.accent, padding: 16, gap: 12,
            }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: t.ink }}>Nuevo recordatorio</Text>

              <View>
                <Text style={s.label}>Título</Text>
                <TextInput style={s.input} value={titulo} onChangeText={setTitulo}
                  placeholder="ANDE, ESSAP, Tarjeta..." placeholderTextColor={t.ink3} />
              </View>

              <View>
                <Text style={s.label}>Fecha de vencimiento</Text>
                <TextInput style={s.input} value={fecha} onChangeText={setFecha}
                  placeholder="YYYY-MM-DD" placeholderTextColor={t.ink3} />
              </View>

              <View>
                <Text style={s.label}>Monto estimado (Gs)</Text>
                <TextInput style={s.input} value={monto}
                  onChangeText={v => setMonto(v.replace(/\D/g, ''))}
                  placeholder="0" placeholderTextColor={t.ink3} keyboardType="numeric" />
              </View>

              <View>
                <Text style={[s.label, { marginBottom: 8 }]}>Repetir</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {(['no', 'mensual'] as const).map(op => (
                    <TouchableOpacity key={op} style={[s.radio, repetir === op && s.radioActive]}
                      onPress={() => setRepetir(op)} activeOpacity={0.7}>
                      <Text style={[s.radioLbl, repetir === op && s.radioLblActive]}>
                        {op === 'no' ? 'No repetir' : 'Mensual'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                <TouchableOpacity style={{
                  flex: 1, paddingVertical: 12, borderRadius: br.md,
                  backgroundColor: t.accent, alignItems: 'center',
                }} onPress={guardar} activeOpacity={0.7}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>Guardar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={{
                  flex: 1, paddingVertical: 12, borderRadius: br.md,
                  backgroundColor: t.hairline, alignItems: 'center',
                }} onPress={() => setShowForm(false)} activeOpacity={0.7}>
                  <Text style={{ fontSize: 14, fontWeight: '500', color: t.ink }}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {!showForm && (
            <TouchableOpacity style={s.addBtn} onPress={() => setShowForm(true)} activeOpacity={0.7}>
              <PlusIcon color={t.accent} />
              <Text style={s.addBtnTxt}>Agregar recordatorio</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}

      {recordatorioConfirmando && (
        <ConfirmModal
          visible={!!confirmandoId}
          titulo={recordatorioConfirmando.titulo}
          onCancel={() => setConfirmandoId(null)}
          onConfirm={ejecutarEliminar}
        />
      )}
    </SafeAreaView>
  );
}
