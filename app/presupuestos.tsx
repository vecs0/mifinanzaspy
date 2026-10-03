/**
 * presupuestos.tsx
 * Responsabilidad: Gestión de presupuestos mensuales por categoría
 * Usado por: expo-router
 * Depende de: budgets, categories
 */
import { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, Alert, TextInput, Keyboard,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import Svg, { Circle, Text as SvgText, Path } from 'react-native-svg';
import { useThemeCtx } from '@/services/ThemeContext';
import { Icon } from '@/components/Icon';
import { EmptyState } from '@/components/EmptyState';
import { InlineError } from '@/components/InlineError';
import { SkeletonRows } from '@/components/Skeleton';
import { localDateKey } from '@/services/dateKeys';
import { CATEGORIAS } from '@/constants/categories';
import { colors, colorsDark, fonts, borderRadius as br, iconStroke, hit } from '@/theme/design-system';
import {
  getPresupuestosConGasto, setPresupuesto, deletePresupuesto,
  type PresupuestoConGasto,
} from '@/services/budgets';

function fmtK(n: number): string {
  return `${Math.round(Math.abs(n) / 1000).toLocaleString('es-PY')}K`;
}

function DonutChart({ pct, t }: { pct: number; t: typeof colors }) {
  const R = 42;
  const circ = 2 * Math.PI * R;
  const dash = (Math.min(pct, 100) / 100) * circ;
  const fillColor = pct > 100 ? t.negative : t.accent;
  return (
    <Svg width={104} height={104} viewBox="0 0 104 104" accessibilityLabel={`${pct} por ciento del presupuesto gastado`}>
      <Circle cx={52} cy={52} r={R} fill="none" stroke={t.hairline} strokeWidth={12} />
      <Circle cx={52} cy={52} r={R} fill="none" stroke={fillColor} strokeWidth={12}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform="rotate(-90 52 52)" />
      <SvgText x={52} y={58} textAnchor="middle" fill={t.ink}
        fontSize={18} fontWeight="700" fontFamily={fonts.mono} letterSpacing={-0.5}>
        {pct}%
      </SvgText>
    </Svg>
  );
}

function BudgetRow({ p, t, onDelete }: { p: PresupuestoConGasto; t: typeof colors; onDelete: () => void }) {
  const exceso   = p.pct > 100;
  const restante = p.montoLimite - p.gastado;
  const cat      = CATEGORIAS.find(c => c.id === p.categoriaId);
  const tinte    = cat?.tinte ?? t.muted;
  const barColor = exceso ? t.negative : tinte;

  return (
    <View style={bc.row}>
      <View style={[bc.iconCircle, { backgroundColor: t.accentBg }]}>
        <Icon name={cat?.icono ?? 'dots'} size={18} color={tinte} />
      </View>
      <View
        style={{ flex: 1 }}
        accessible
        accessibilityLabel={`${cat?.nombre ?? p.categoriaId}: ${p.pct} por ciento usado, ${exceso ? 'excedido' : 'restan'} ${Math.abs(restante)} guaraníes`}
      >
        <View style={bc.line}>
          <Text style={[bc.catNombre, { color: t.ink }]} numberOfLines={1}>
            {cat?.nombre ?? p.categoriaId}
          </Text>
          <Text style={[bc.pct, { color: exceso ? t.negative : t.ink }]}>{p.pct}%</Text>
        </View>
        <View style={[bc.track, { backgroundColor: t.hairline }]}>
          <View style={[bc.fill, { width: `${Math.min(100, p.pct)}%`, backgroundColor: barColor }]} />
        </View>
        <View style={bc.line}>
          <Text style={[bc.usado, { color: t.ink2 }]}>Gs {fmtK(p.gastado)} de {fmtK(p.montoLimite)}</Text>
          <Text style={[bc.usado, { color: exceso ? t.negative : t.ink2 }]}>
            {exceso ? `Excedido Gs ${fmtK(restante)}` : `Quedan Gs ${fmtK(restante)}`}
          </Text>
        </View>
      </View>
      <TouchableOpacity
        onPress={onDelete}
        hitSlop={hit}
        style={bc.del}
        accessibilityRole="button"
        accessibilityLabel={`Eliminar presupuesto de ${cat?.nombre ?? p.categoriaId}`}
      >
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"
          stroke={t.muteText} strokeWidth={iconStroke} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M18 6L6 18M6 6l12 12" />
        </Svg>
      </TouchableOpacity>
    </View>
  );
}

const bc = StyleSheet.create({
  row:        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  iconCircle: { width: 44, height: 44, borderRadius: br.md, alignItems: 'center', justifyContent: 'center' },
  line:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  catNombre:  { flex: 1, fontSize: 15, fontWeight: '600', fontFamily: fonts.ui },
  pct:        { fontSize: 14, fontWeight: '700', fontFamily: fonts.mono, fontVariant: ['tabular-nums'] },
  track:      { height: 6, borderRadius: 3, overflow: 'hidden', marginVertical: 8 },
  fill:       { height: '100%', borderRadius: 3 },
  usado:      { fontSize: 12, fontFamily: fonts.mono, fontVariant: ['tabular-nums'] },
  del:        { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -12 },
});

function AgregarModal({ visible, onClose, onAgregar, existentes, t }: {
  visible: boolean; onClose: () => void; onAgregar: (catId: string, monto: number) => void;
  existentes: string[]; t: typeof colors;
}) {
  const insets      = useSafeAreaInsets();
  const [montoStr, setMontoStr]   = useState('500.000');
  const [catSel, setCatSel]       = useState<string | null>(null);
  const disponibles = CATEGORIAS.filter(c => c.tipo === 'egreso' && !existentes.includes(c.id));
  const montoNum    = parseInt(montoStr.replace(/\./g, '').replace(/,/g, ''), 10) || 0;
  const montoValido = montoNum >= 1000;
  const puedeAgregar = montoValido && catSel !== null;

  useEffect(() => { if (!visible) { setMontoStr('500.000'); setCatSel(null); } }, [visible]);

  function handleAgregar() {
    if (!puedeAgregar || !catSel) return;
    Keyboard.dismiss();
    onAgregar(catSel, montoNum);
    onClose();
  }

  function formatMonto(v: string) {
    const n = parseInt(v.replace(/\D/g, ''), 10) || 0;
    if (n === 0) return '';
    return n.toLocaleString('es-PY').replace(/,/g, '.');
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => { Keyboard.dismiss(); onClose(); }}>
      <TouchableOpacity style={{ flex: 1, backgroundColor: t.scrim }}
        activeOpacity={1} onPress={() => { Keyboard.dismiss(); onClose(); }}
        accessibilityRole="button" accessibilityLabel="Cerrar" />
      <View style={[am.sheet, { backgroundColor: t.bg, paddingBottom: insets.bottom + 24 }]}>
        <View style={[am.pill, { backgroundColor: t.hairline }]} />

        <View style={am.hdrRow}>
          <View style={{ flex: 1 }}>
            <Text style={[am.eyebrow, { color: t.muteText }]}>Nuevo presupuesto</Text>
            <Text style={[am.heading, { color: t.ink }]}>¿Cuánto querés gastar?</Text>
          </View>
          <TouchableOpacity
            onPress={() => { Keyboard.dismiss(); onClose(); }}
            style={am.closeBtn}
            accessibilityRole="button"
            accessibilityLabel="Cerrar">
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"
              stroke={t.ink2} strokeWidth={iconStroke} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M18 6L6 18M6 6l12 12" />
            </Svg>
          </TouchableOpacity>
        </View>

        <Text style={[am.label, { color: t.muteText }]}>Límite mensual</Text>
        <View style={[am.inputRow, { borderColor: t.hairline, backgroundColor: t.card }]}>
          <Text style={[am.inputPfx, { color: t.ink2 }]}>Gs</Text>
          <TextInput
            style={[am.input, { color: t.ink }]}
            value={montoStr}
            onChangeText={v => setMontoStr(formatMonto(v))}
            keyboardType="number-pad"
            placeholder="500.000"
            placeholderTextColor={t.muteText}
            maxLength={14}
            accessibilityLabel="Límite mensual en guaraníes"
          />
        </View>
        {!montoValido && montoStr.length > 0 && (
          <Text style={[am.error, { color: t.negative }]}>El mínimo es Gs 1.000</Text>
        )}

        <Text style={[am.label, { color: t.muteText, marginTop: 16 }]}>Categoría</Text>

        {disponibles.length === 0 ? (
          <Text style={[am.emptyTxt, { color: t.ink2 }]}>
            Ya tenés presupuesto para todas las categorías de egreso.
          </Text>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 232 }}>
            <View style={am.catGrid}>
              {disponibles.map(cat => {
                const sel = catSel === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[am.catChip, {
                      backgroundColor: sel ? t.accentBg : 'transparent',
                      borderColor: sel ? t.accent : t.hairline,
                    }]}
                    onPress={() => setCatSel(sel ? null : cat.id)}
                    activeOpacity={0.75}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: sel }}
                    accessibilityLabel={cat.nombre}
                  >
                    <Icon name={cat.icono} size={18} color={sel ? t.accent : cat.tinte} />
                    <Text style={[am.catNombre, { color: sel ? t.accent : t.ink }]} numberOfLines={1}>
                      {cat.nombre}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        )}

        <TouchableOpacity
          style={[am.btn, { backgroundColor: t.accent, opacity: puedeAgregar ? 1 : 0.4 }]}
          onPress={handleAgregar}
          disabled={!puedeAgregar}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityState={{ disabled: !puedeAgregar }}
        >
          <Text style={[am.btnTxt, { color: t.onAccent }]}>
            {catSel
              ? `Agregar · ${CATEGORIAS.find(c => c.id === catSel)?.nombre ?? ''}`
              : 'Elegí una categoría'}
          </Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const am = StyleSheet.create({
  sheet:   { borderTopLeftRadius: br.xl, borderTopRightRadius: br.xl, paddingHorizontal: 24, paddingTop: 12 },
  pill:    { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  hdrRow:  { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  closeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -12 },
  eyebrow: { fontSize: 11, letterSpacing: 1.1, textTransform: 'uppercase', fontWeight: '600', fontFamily: fonts.ui, marginBottom: 4 },
  heading: { fontFamily: fonts.display, fontStyle: 'italic', fontSize: 24, fontWeight: '400' },
  label:   { fontSize: 11, letterSpacing: 1.1, textTransform: 'uppercase', fontFamily: fonts.ui, fontWeight: '600', marginBottom: 8 },
  inputRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: br.md, borderWidth: 1, paddingHorizontal: 16, height: 52 },
  inputPfx:  { fontFamily: fonts.display, fontStyle: 'italic', fontSize: 18 },
  input:     { flex: 1, fontSize: 20, fontFamily: fonts.mono, paddingVertical: 0, fontVariant: ['tabular-nums'] },
  error:     { fontSize: 13, fontFamily: fonts.ui, marginTop: 8 },
  catGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 4 },
  catChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44,
    paddingHorizontal: 12, borderRadius: br.full, borderWidth: 1,
  },
  catNombre: { fontSize: 14, fontWeight: '500', fontFamily: fonts.ui },
  emptyTxt:  { fontSize: 14, fontFamily: fonts.ui, lineHeight: 20 },
  btn:       { minHeight: 52, borderRadius: br.lg, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  btnTxt:    { fontSize: 16, fontWeight: '600', fontFamily: fonts.ui },
});

export default function PresupuestosScreen() {
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;
  const mes = localDateKey().slice(0, 7);
  const mesLabel = new Date().toLocaleDateString('es-PY', { month: 'long', year: 'numeric' });

  const [presupuestos, setPresupuestos] = useState<PresupuestoConGasto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAgregar, setShowAgregar] = useState(false);

  const cargar = useCallback(() => {
    setError(null);
    try {
      setPresupuestos(getPresupuestosConGasto(mes));
    } catch (e) {
      console.error('Presupuestos error:', e);
      setError('No pudimos cargar tus presupuestos.');
    } finally {
      setCargando(false);
    }
  }, [mes]);

  useFocusEffect(cargar);

  const totalLim  = presupuestos.reduce((acc, p) => acc + p.montoLimite, 0);
  const totalGast = presupuestos.reduce((acc, p) => acc + p.gastado, 0);
  const totalPct  = totalLim > 0 ? Math.round((totalGast / totalLim) * 100) : 0;

  return (
    <SafeAreaView style={[s.flex, { backgroundColor: t.bg }]}>
      <View style={s.headerRow}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={hit}
          style={s.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Volver">
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none"
            stroke={t.ink} strokeWidth={iconStroke} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M19 12H5M12 19l-7-7 7-7" />
          </Svg>
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 4 }}>
          <Text style={[s.eyebrow, { color: t.muteText }]}>Presupuestos · {mesLabel}</Text>
          <Text style={[s.heading, { color: t.ink }]} accessibilityRole="header">Tu límite, tu ritmo</Text>
        </View>
      </View>

      {cargando ? (
        <View style={{ paddingHorizontal: 24, paddingTop: 16 }}><SkeletonRows count={4} /></View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
          {error && (
            <View style={{ paddingHorizontal: 24, marginBottom: 16 }}>
              <InlineError mensaje={error} onReintentar={cargar} />
            </View>
          )}

          {presupuestos.length > 0 && (
            <View style={s.resumen}>
              <DonutChart pct={totalPct} t={t} />
              <View style={{ flex: 1 }}>
                <Text style={[s.resumenEyebrow, { color: t.muteText }]}>
                  Gastado en {new Date().toLocaleDateString('es-PY', { month: 'long' })}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 2 }}>
                  <Text style={[s.resumenGs, { color: t.ink }]}>Gs</Text>
                  <Text style={[s.resumenMonto, { color: t.ink }]}>
                    {(totalGast / 1000000).toFixed(2)}M
                  </Text>
                </View>
                <Text style={[s.resumenSub, { color: t.ink2 }]}>
                  de Gs {(totalLim / 1000000).toFixed(1)}M asignados
                </Text>
              </View>
            </View>
          )}

          {presupuestos.length === 0 ? (
            <EmptyState
              titulo={`Sin presupuestos en ${mesLabel}`}
              texto="Poné un tope mensual por categoría, por ejemplo comida o transporte, y mirá cuánto te queda."
              accion="Crear mi primer presupuesto"
              onAccion={() => setShowAgregar(true)}
            />
          ) : (
            <View style={s.lista}>
              {presupuestos.map((p, i) => (
                <View key={p.id}>
                  <BudgetRow p={p} t={t} onDelete={() => {
                    Alert.alert(
                      'Eliminar presupuesto',
                      `¿Eliminar el presupuesto de ${CATEGORIAS.find(c => c.id === p.categoriaId)?.nombre ?? p.categoriaId}?`,
                      [
                        { text: 'Cancelar', style: 'cancel' },
                        { text: 'Eliminar', style: 'destructive', onPress: () => {
                          try {
                            deletePresupuesto(p.categoriaId, mes);
                            cargar();
                          } catch {
                            setError('No pudimos eliminar el presupuesto.');
                          }
                        }},
                      ],
                    );
                  }} />
                  {i < presupuestos.length - 1 && <View style={[s.divider, { backgroundColor: t.hairline }]} />}
                </View>
              ))}
            </View>
          )}

          {presupuestos.length > 0 && (
            <TouchableOpacity
              style={[s.addBtn, { backgroundColor: t.accent }]}
              onPress={() => setShowAgregar(true)} activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Nuevo presupuesto">
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"
                stroke={t.onAccent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M12 5v14M5 12h14" />
              </Svg>
              <Text style={[s.addBtnTxt, { color: t.onAccent }]}>Nuevo presupuesto</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}

      <AgregarModal
        visible={showAgregar}
        onClose={() => setShowAgregar(false)}
        onAgregar={(catId, monto) => {
          try {
            setPresupuesto(catId, monto, mes);
            cargar();
          } catch {
            setError('No pudimos guardar el presupuesto. Intentá de nuevo.');
          }
        }}
        existentes={presupuestos.map(p => p.categoriaId)}
        t={t}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 12, paddingTop: 4, paddingBottom: 16 },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontSize: 11, letterSpacing: 1.1, textTransform: 'uppercase', fontWeight: '600', fontFamily: fonts.ui, marginBottom: 4, marginTop: 6 },
  heading: { fontFamily: fonts.display, fontStyle: 'italic', fontWeight: '400', fontSize: 30, lineHeight: 34, letterSpacing: -0.8 },
  scroll: { paddingBottom: 48 },
  resumen: { flexDirection: 'row', alignItems: 'center', gap: 20, paddingHorizontal: 24, marginBottom: 24 },
  resumenEyebrow: { fontSize: 12, fontFamily: fonts.ui },
  resumenGs:    { fontFamily: fonts.display, fontStyle: 'italic', fontSize: 20 },
  resumenMonto: { fontFamily: fonts.mono, fontSize: 30, fontWeight: '700', letterSpacing: -0.8, fontVariant: ['tabular-nums'] },
  resumenSub:   { fontSize: 13, marginTop: 2, fontFamily: fonts.ui },
  lista:    { paddingHorizontal: 24 },
  divider:  { height: StyleSheet.hairlineWidth },
  addBtn:   { marginHorizontal: 24, marginTop: 24, minHeight: 52, borderRadius: br.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  addBtnTxt: { fontSize: 16, fontWeight: '600', fontFamily: fonts.ui },
});
