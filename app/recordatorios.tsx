/**
 * recordatorios.tsx
 * Responsabilidad: Gestión de recordatorios de pago
 * Usado por: expo-router
 * Depende de: reminders
 */
import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useThemeCtx } from '@/services/ThemeContext';
import { colors, colorsDark, borderRadius as br, iconStroke, hit } from '@/theme/design-system';
import { EmptyState } from '@/components/EmptyState';
import { InlineError } from '@/components/InlineError';
import { SkeletonRows } from '@/components/Skeleton';
import { getRecordatorios, insertRecordatorio, deleteRecordatorio, type Recordatorio } from '@/services/reminders';

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

function useStyles(t: typeof colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    hdr: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 12, paddingTop: 4,
    },
    backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 44, paddingHorizontal: 4 },
    backTxt: { fontSize: 15, fontWeight: '600', color: t.accent },
    titleBlock: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 8 },
    title: { fontSize: 26, fontWeight: '700', color: t.ink },
    secLabel: {
      fontSize: 11, fontWeight: '600', color: t.muteText,
      letterSpacing: 1.1, textTransform: 'uppercase',
      paddingHorizontal: 24, paddingBottom: 8,
    },
    card: {
      marginHorizontal: 24,
      paddingVertical: 16,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.hairline,
    },
    cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, gap: 12 },
    cardName: { fontSize: 15, fontWeight: '600', color: t.ink, flex: 1 },
    cardAmt: { fontSize: 15, fontWeight: '700', color: t.ink, fontFamily: 'GeistMono', fontVariant: ['tabular-nums'] },
    cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    cardMetaTxt: { fontSize: 13, color: t.ink2 },
    cardMetaUrgent: { color: t.negative, fontWeight: '600' },
    deleteBtn: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
    deleteBtnTxt: { fontSize: 13, color: t.negative, fontWeight: '600' },
    addBtn: {
      marginHorizontal: 24, marginBottom: 24, marginTop: 16,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      minHeight: 52,
      backgroundColor: t.accent,
      borderRadius: br.lg,
    },
    addBtnTxt: { fontSize: 15, fontWeight: '600', color: t.onAccent },
    form: {
      marginHorizontal: 24, marginTop: 16, marginBottom: 12,
      backgroundColor: t.surface,
      borderRadius: br.lg, padding: 16, gap: 16,
    },
    label: { fontSize: 11, fontWeight: '600', color: t.muteText, textTransform: 'uppercase', letterSpacing: 1 },
    input: {
      borderWidth: 1, borderColor: t.hairline, borderRadius: br.md,
      paddingHorizontal: 12, minHeight: 48, fontSize: 15, color: t.ink, backgroundColor: t.bg, marginTop: 6,
    },
    radio: {
      paddingHorizontal: 16, minHeight: 44, justifyContent: 'center', borderRadius: br.full,
      borderWidth: 1, borderColor: t.hairline,
    },
    radioActive: { backgroundColor: t.accent, borderColor: t.accent },
    radioLbl: { fontSize: 14, color: t.ink },
    radioLblActive: { color: t.onAccent },
  });
}

function SmallCalIcon({ color }: { color: string }) {
  return (
    <Svg width={12} height={12} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={iconStroke} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 9h18M9 3v4m6-4v4" />
      <Path d="M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
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
      <View style={{ flex: 1, backgroundColor: t.scrim, justifyContent: 'flex-end' }}>
        <TouchableOpacity style={{ flex: 1 }} onPress={onCancel} />
        <View style={{
          backgroundColor: t.card,
          borderTopLeftRadius: br.xl, borderTopRightRadius: br.xl,
          paddingTop: 24, paddingHorizontal: 24, paddingBottom: 40, gap: 16,
        }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: t.hairline, alignSelf: 'center', marginBottom: 4 }} />
          <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: t.negativeBg, alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={t.negative} strokeWidth={iconStroke} strokeLinecap="round">
              <Path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
            </Svg>
          </View>
          <Text style={{ fontSize: 17, fontWeight: '700', color: t.ink }}>Eliminar recordatorio</Text>
          <Text style={{ fontSize: 14, color: t.ink2, lineHeight: 20 }}>
            Se eliminará "{titulo}" y su notificación programada.
          </Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
            <TouchableOpacity style={{
              flex: 1, minHeight: 52, justifyContent: 'center', borderRadius: br.md,
              backgroundColor: t.surface, alignItems: 'center',
            }} onPress={onCancel} activeOpacity={0.7}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: t.ink }}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{
              flex: 1, minHeight: 52, justifyContent: 'center', borderRadius: br.md,
              backgroundColor: t.negative, alignItems: 'center',
            }} onPress={onConfirm} activeOpacity={0.7}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: t.onAccent }}>Eliminar</Text>
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
  const s = useStyles(t);

  const [recordatorios, setRecordatorios] = useState<Recordatorio[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);

  const [titulo, setTitulo] = useState('');
  const [fecha, setFecha] = useState('');
  const [monto, setMonto] = useState('');
  const [repetir, setRepetir] = useState<Recordatorio['repetir']>('no');

  function cargar() {
    try {
      setRecordatorios(getRecordatorios());
    } catch (e) {
      console.error('Recordatorios error:', e);
      setError('No pudimos cargar tus recordatorios.');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => { cargar(); }, []);

  function guardar() {
    if (!titulo.trim()) { setError('Poné un título, por ejemplo ANDE o Tarjeta.'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || isNaN(new Date(fecha).getTime())) { setError('La fecha debe tener el formato AAAA-MM-DD.'); return; }
    setError(null);
    try {
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
    } catch (e) {
      console.error('Guardar recordatorio:', e);
      setError('No pudimos guardar el recordatorio. Probá de nuevo.');
    }
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
          hitSlop={hit}
          style={s.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Volver a Ajustes"
        >
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none"
            stroke={t.accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M15 18l-6-6 6-6" />
          </Svg>
          <Text style={s.backTxt}>Ajustes</Text>
        </TouchableOpacity>
      </View>

      <View style={s.titleBlock}>
        <Text style={s.title} accessibilityRole="header">Recordatorios</Text>
      </View>

      {cargando ? (
        <View style={{ paddingHorizontal: 24, paddingTop: 16 }}><SkeletonRows count={3} /></View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          <Text style={s.secLabel}>
            Pagos pendientes{recordatorios.length > 0 ? ` · ${recordatorios.length}` : ''}
          </Text>

          {error && (
            <View style={{ paddingHorizontal: 24, marginBottom: 12 }}>
              <InlineError mensaje={error} onReintentar={error.startsWith('No pudimos cargar') ? cargar : undefined} />
            </View>
          )}

          {recordatorios.length === 0 && !showForm && (
            <EmptyState
              titulo="Todavía no tenés recordatorios"
              texto="Agregá vencimientos de ANDE, ESSAP o tarjetas y te avisamos antes de que venzan."
              accion="Agregar el primero"
              onAccion={() => setShowForm(true)}
            />
          )}

          {recordatorios.map(r => {
            const days = daysUntil(r.fecha);
            const urgent = days <= 1;
            return (
              <View key={r.id} style={s.card}>
                <View style={s.cardTop}>
                  <Text style={s.cardName}>{r.titulo}</Text>
                  {r.montoEstimado > 0 && (
                    <Text style={s.cardAmt}>
                      Gs {r.montoEstimado.toLocaleString('es-PY').replace(/,/g, '.')}
                    </Text>
                  )}
                </View>
                <View style={s.cardMeta}>
                  <SmallCalIcon color={urgent ? t.negative : t.ink3} />
                  <Text style={[s.cardMetaTxt, urgent && s.cardMetaUrgent]}>{fechaLabel(r.fecha)}{urgent ? ' · Urgente' : ''}</Text>
                </View>
                <TouchableOpacity
                  style={s.deleteBtn}
                  onPress={() => confirmarEliminar(r.id)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`Eliminar recordatorio ${r.titulo}`}
                >
                  <Text style={s.deleteBtnTxt}>Eliminar</Text>
                </TouchableOpacity>
              </View>
            );
          })}

          {showForm && (
            <View style={s.form}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: t.ink }}>Nuevo recordatorio</Text>

              <View>
                <Text style={s.label}>Título</Text>
                <TextInput style={s.input} value={titulo} onChangeText={setTitulo}
                  placeholder="ANDE, ESSAP, Tarjeta..." placeholderTextColor={t.muteText} accessibilityLabel="Título" />
              </View>

              <View>
                <Text style={s.label}>Fecha de vencimiento</Text>
                <TextInput style={s.input} value={fecha} onChangeText={setFecha}
                  placeholder="AAAA-MM-DD" placeholderTextColor={t.muteText} accessibilityLabel="Fecha de vencimiento" />
              </View>

              <View>
                <Text style={s.label}>Monto estimado (Gs)</Text>
                <TextInput style={s.input} value={monto}
                  onChangeText={v => setMonto(v.replace(/\D/g, ''))}
                  placeholder="0" placeholderTextColor={t.muteText} keyboardType="numeric" accessibilityLabel="Monto estimado en guaraníes" />
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
                  flex: 1, minHeight: 52, justifyContent: 'center', borderRadius: br.md,
                  backgroundColor: t.accent, alignItems: 'center',
                }} onPress={guardar} activeOpacity={0.7} accessibilityRole="button">
                  <Text style={{ fontSize: 15, fontWeight: '600', color: t.onAccent }}>Guardar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={{
                  flex: 1, minHeight: 52, justifyContent: 'center', borderRadius: br.md,
                  backgroundColor: t.hairline, alignItems: 'center',
                }} onPress={() => { setShowForm(false); setError(null); }} activeOpacity={0.7} accessibilityRole="button">
                  <Text style={{ fontSize: 15, fontWeight: '500', color: t.ink }}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {!showForm && (
            <TouchableOpacity style={s.addBtn} onPress={() => setShowForm(true)} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel="Agregar recordatorio">
              <PlusIcon color={t.onAccent} />
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
