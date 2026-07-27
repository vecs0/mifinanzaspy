/**
 * presupuestos.tsx
 * Responsabilidad: Gestión de presupuestos con donut SVG y grid 2-col
 * Usado por: expo-router
 * Depende de: budgets, categories
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Modal, Alert, TextInput, Animated, Easing, Keyboard,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import Svg, { Circle, Text as SvgText, Path } from 'react-native-svg';
import { useThemeCtx } from '@/services/ThemeContext';
import { Icon } from '@/components/Icon';
import { CATEGORIAS } from '@/constants/categories';
import { colors, colorsDark, fonts, borderRadius as br } from '@/theme/design-system';
import {
  getPresupuestosConGasto, setPresupuesto, deletePresupuesto,
  type PresupuestoConGasto,
} from '@/services/budgets';

function FadeSlideIn({ children, delay = 0, style }: {
  children: React.ReactNode; delay?: number; style?: any;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1, duration: 300, delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, []);
  return (
    <Animated.View style={[{ opacity: anim, transform: [{ translateY: anim.interpolate({
      inputRange: [0, 1], outputRange: [8, 0],
    }) }] }, style]}>
      {children}
    </Animated.View>
  );
}

function DonutChart({ pct, accent, t }: { pct: number; accent: string; t: typeof colors }) {
  const R = 42;
  const circ = 2 * Math.PI * R;
  const dash = (Math.min(pct, 100) / 100) * circ;
  const fillColor = pct > 100 ? t.negative : accent;
  return (
    <Svg width={104} height={104} viewBox="0 0 104 104">
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


function BudgetCard({ p, t, dark, onDelete }: { p: PresupuestoConGasto; t: typeof colors; dark: boolean; onDelete: () => void }) {
  const exceso   = p.pct > 100;
  const restante = p.montoLimite - p.gastado;
  const cat      = CATEGORIAS.find(c => c.id === p.categoriaId);
  const tinte    = cat?.tinte ?? '#888';
  const barColor = exceso ? t.negative : tinte;
  const iconBg   = `${tinte}${dark ? '22' : '18'}`;
  const barAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(barAnim, {
      toValue: Math.min(100, p.pct), duration: 600, delay: 100,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, []);

  return (
    <View style={[bc.card, { backgroundColor: t.card, borderColor: t.hairline }]}>
      <View style={bc.top}>
        <View style={[bc.iconCircle, { backgroundColor: iconBg }]}>
          <Icon name={cat?.icono ?? 'dots'} size={13} color={tinte} />
        </View>
        <Text style={[bc.catNombre, { color: t.ink }]} numberOfLines={1}>
          {cat?.nombre ?? p.categoriaId}
        </Text>
        <TouchableOpacity onPress={onDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none"
            stroke={t.ink3} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M18 6L6 18M6 6l12 12" />
          </Svg>
        </TouchableOpacity>
      </View>

      <View style={bc.row}>
        <Text style={[bc.pct, { color: exceso ? t.negative : tinte }]}>{p.pct}%</Text>
        <Text style={[bc.restante, { color: exceso ? t.negative : t.ink3 }]}>
          {exceso ? `−Gs ${Math.abs(restante / 1000).toFixed(0)}K` : `Gs ${(restante / 1000).toFixed(0)}K rest.`}
        </Text>
      </View>

      <View style={[bc.track, { backgroundColor: t.hairline }]}>
        <Animated.View style={[bc.fill, {
          width: barAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
          backgroundColor: barColor,
        }]} />
      </View>

      <View style={bc.row}>
        <Text style={[bc.usado, { color: t.ink3 }]}>Gs {(p.gastado / 1000).toFixed(0)}K usado</Text>
        <Text style={[bc.limite, { color: t.ink3 }]}>/ Gs {(p.montoLimite / 1000).toFixed(0)}K</Text>
      </View>
    </View>
  );
}

const bc = StyleSheet.create({
  card:       { padding: 12, borderRadius: br.lg, borderWidth: 1 },
  top:        { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 8 },
  iconCircle: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  catNombre:  { flex: 1, fontSize: 12, fontWeight: '600', fontFamily: fonts.ui },
  row:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 },
  pct:        { fontSize: 11, fontWeight: '700', fontFamily: fonts.mono },
  restante:   { fontSize: 10, fontFamily: fonts.mono },
  track:      { height: 5, borderRadius: 3, overflow: 'hidden', marginBottom: 5 },
  fill:       { height: '100%', borderRadius: 3 },
  usado:      { fontSize: 10, fontFamily: fonts.mono },
  limite:     { fontSize: 10, fontFamily: fonts.mono },
});

function AgregarModal({ visible, onClose, onAgregar, existentes, t, dark }: {
  visible: boolean; onClose: () => void; onAgregar: (catId: string, monto: number) => void;
  existentes: string[]; t: typeof colors; dark: boolean;
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
      <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}
        activeOpacity={1} onPress={() => { Keyboard.dismiss(); onClose(); }} />
      <View style={[am.sheet, { backgroundColor: t.bg, paddingBottom: insets.bottom + 16 }]}>
        <View style={[am.pill, { backgroundColor: t.hairline }]} />

        <View style={am.hdrRow}>
          <View>
            <Text style={[am.eyebrow, { color: t.ink3 }]}>Nuevo presupuesto</Text>
            <Text style={[am.heading, { color: t.ink }]}>¿Cuánto querés gastar?</Text>
          </View>
          <TouchableOpacity onPress={() => { Keyboard.dismiss(); onClose(); }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"
              stroke={t.ink3} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M18 6L6 18M6 6l12 12" />
            </Svg>
          </TouchableOpacity>
        </View>

        <Text style={[am.label, { color: t.ink3 }]}>Límite mensual</Text>
        <View style={[am.inputRow, { borderColor: t.hairline, backgroundColor: t.card }]}>
          <Text style={[am.inputPfx, { color: t.ink2 }]}>Gs</Text>
          <TextInput
            style={[am.input, { color: t.ink }]}
            value={montoStr}
            onChangeText={v => setMontoStr(formatMonto(v))}
            keyboardType="number-pad"
            placeholder="500.000"
            placeholderTextColor={t.ink3}
            maxLength={14}
          />
        </View>
        {!montoValido && montoStr.length > 0 && (
          <Text style={[am.error, { color: t.negative }]}>Mínimo Gs 1.000</Text>
        )}

        <Text style={[am.label, { color: t.ink3, marginTop: 14 }]}>Categoría</Text>

        {disponibles.length === 0 ? (
          <View style={[am.emptyBox, { borderColor: t.hairline }]}>
            <Text style={[am.emptyTxt, { color: t.ink3 }]}>
              Ya tenés presupuesto para todas las categorías de egreso.
            </Text>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 220 }}>
            <View style={am.catGrid}>
              {disponibles.map(cat => {
                const sel    = catSel === cat.id;
                const iconBg = sel
                  ? cat.tinte
                  : `${cat.tinte}${dark ? '22' : '18'}`;
                const iconColor = sel ? '#fff' : cat.tinte;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[am.catCard, {
                      backgroundColor: sel
                        ? `${cat.tinte}${dark ? '22' : '12'}`
                        : t.card,
                      borderColor: sel ? cat.tinte : t.hairline,
                    }]}
                    onPress={() => setCatSel(sel ? null : cat.id)}
                    activeOpacity={0.75}
                  >
                    <View style={[am.catIco, { backgroundColor: iconBg }]}>
                      <Icon name={cat.icono} size={14} color={iconColor} />
                    </View>
                    <Text style={[am.catNombre, { color: sel ? cat.tinte : t.ink }]} numberOfLines={2}>
                      {cat.nombre}
                    </Text>
                    {sel && (
                      <View style={[am.checkDot, { backgroundColor: cat.tinte }]}>
                        <Svg width={8} height={8} viewBox="0 0 24 24" fill="none"
                          stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                          <Path d="M20 6L9 17l-5-5" />
                        </Svg>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        )}

        <TouchableOpacity
          style={[am.btn, { backgroundColor: t.accent, opacity: puedeAgregar ? 1 : 0.35 }]}
          onPress={handleAgregar}
          disabled={!puedeAgregar}
          activeOpacity={0.85}
        >
          <Text style={[am.btnTxt, { color: t.bg }]}>
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
  sheet:   { borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 20, paddingTop: 10 },
  pill:    { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
  hdrRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  eyebrow: { fontSize: 10.5, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: '600', fontFamily: fonts.ui, marginBottom: 2 },
  heading: { fontFamily: fonts.display, fontStyle: 'italic', fontSize: 22, fontWeight: '400' },
  label:   { fontSize: 10.5, letterSpacing: 1, textTransform: 'uppercase', fontFamily: fonts.ui, fontWeight: '600', marginBottom: 8 },
  inputRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, height: 50 },
  inputPfx:  { fontFamily: fonts.display, fontStyle: 'italic', fontSize: 18 },
  input:     { flex: 1, fontSize: 18, fontFamily: fonts.mono, paddingVertical: 0 },
  error:     { fontSize: 11, fontFamily: fonts.ui, marginTop: 4 },
  catGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 4 },
  catCard: {
    width: '31%', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 6,
    borderRadius: 12, borderWidth: 1, gap: 6, position: 'relative',
  },
  catIco:    { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  catNombre: { fontSize: 11, fontWeight: '500', fontFamily: fonts.ui, textAlign: 'center' },
  checkDot:  { position: 'absolute', top: 6, right: 6, width: 14, height: 14, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  emptyBox:  { padding: 20, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', marginBottom: 14 },
  emptyTxt:  { fontSize: 12, fontFamily: fonts.ui, textAlign: 'center', lineHeight: 18 },
  btn:       { height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  btnTxt:    { fontSize: 14, fontWeight: '600', fontFamily: fonts.ui },
});

export default function PresupuestosScreen() {
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;
  const accent = t.accent;
  const mes = new Date().toISOString().slice(0, 7);
  const mesLabel = new Date().toLocaleDateString('es-PY', { month: 'long', year: 'numeric' });

  const [presupuestos, setPresupuestos] = useState<PresupuestoConGasto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [showAgregar, setShowAgregar] = useState(false);

  const cargar = useCallback(() => {
    setCargando(true);
    try {
      const p = getPresupuestosConGasto(mes);
      setPresupuestos(p);
    } catch {
      Alert.alert('Error', 'No se pudieron cargar los presupuestos.');
    } finally {
      setCargando(false);
    }
  }, [mes]);

  useFocusEffect(cargar);

  const totalLim  = presupuestos.reduce((s, p) => s + p.montoLimite, 0);
  const totalGast = presupuestos.reduce((s, p) => s + p.gastado, 0);
  const totalPct  = totalLim > 0 ? Math.round((totalGast / totalLim) * 100) : 0;

  return (
    <SafeAreaView style={[s.flex, { backgroundColor: t.bg }]}>
      <View style={s.headerRow}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="Volver">
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"
            stroke={accent} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M19 12H5M12 19l-7-7 7-7" />
          </Svg>
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[s.eyebrow, { color: t.ink3 }]}>Presupuestos - {mesLabel}</Text>
          <Text style={[s.heading, { color: t.ink }]}>{'Tu limite,\ntu ritmo.'}</Text>
        </View>
      </View>

      {cargando ? (
        <ActivityIndicator color={accent} style={{ flex: 1 }} />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
          {presupuestos.length > 0 && (
            <FadeSlideIn delay={50}>
              <View style={[s.resumen, { backgroundColor: t.card, borderColor: t.hairline }]}>
                <DonutChart pct={totalPct} accent={accent} t={t} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.resumenEyebrow, { color: t.ink3 }]}>
                    Gastado en {new Date().toLocaleDateString('es-PY', { month: 'long' })}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 2 }}>
                    <Text style={[s.resumenGs, { color: t.ink }]}>Gs</Text>
                    <Text style={[s.resumenMonto, { color: t.ink }]}>
                      {(totalGast / 1000000).toFixed(2)}M
                    </Text>
                  </View>
                  <Text style={[s.resumenSub, { color: t.ink3 }]}>
                    de Gs {(totalLim / 1000000).toFixed(1)}M asignados
                  </Text>
                </View>
              </View>
            </FadeSlideIn>
          )}

          <View style={s.tabs}>
            <View style={[s.tab, { backgroundColor: dark ? t.surface : t.ink }]}>
              <Text style={[s.tabTxt, { color: dark ? t.ink : t.bg }]}>Mis presupuestos</Text>
              <View style={[s.tabBadge, { backgroundColor: dark ? 'rgba(241,237,230,0.1)' : 'rgba(250,248,244,0.18)' }]}>
                <Text style={[s.tabBadgeTxt, { color: dark ? t.ink : t.bg }]}>{presupuestos.length}</Text>
              </View>
            </View>
          </View>

          {presupuestos.length === 0 ? (
            <View style={[s.emptyBox, { borderColor: t.hairline }]}>
              <Svg width={24} height={24} viewBox="0 0 24 24" fill="none"
                stroke={t.ink3} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M12 3v9h9a9 9 0 11-9-9z" />
                <Path d="M14 3a7 7 0 017 7h-7V3z" />
              </Svg>
              <Text style={[s.emptyTxt, { color: t.ink3 }]}>
                {'Sin presupuestos en ' + mesLabel + '.\nAgregá uno y tomá el control.'}
              </Text>
            </View>
          ) : (
            <View style={s.grid}>
              {presupuestos.map((p, i) => (
                <FadeSlideIn key={p.id} delay={100 + i * 80} style={s.gridItem}>
                  <BudgetCard p={p} t={t} dark={dark} onDelete={() => {
                    Alert.alert(
                      'Eliminar presupuesto',
                      `¿Eliminar el presupuesto de ${CATEGORIAS.find(c => c.id === p.categoriaId)?.nombre ?? p.categoriaId}?`,
                      [
                        { text: 'Cancelar', style: 'cancel' },
                        { text: 'Eliminar', style: 'destructive', onPress: () => {
                          deletePresupuesto(p.categoriaId, mes);
                          cargar();
                        }},
                      ],
                    );
                  }} />
                </FadeSlideIn>
              ))}
            </View>
          )}

          <FadeSlideIn delay={100 + presupuestos.length * 80}>
          <TouchableOpacity
            style={[s.addDash, { borderColor: dark ? 'rgba(241,237,230,0.18)' : 'rgba(0,0,0,0.13)' }]}
            onPress={() => setShowAgregar(true)} activeOpacity={0.7}
            accessibilityLabel="Nuevo presupuesto">
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none"
              stroke={t.ink2} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M12 5v14M5 12h14" />
            </Svg>
            <Text style={[s.addDashTxt, { color: t.ink2 }]}>Nuevo presupuesto</Text>
          </TouchableOpacity>
          </FadeSlideIn>
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
            Alert.alert('Error', 'No se pudo guardar el presupuesto. Intentá de nuevo.');
          }
        }}
        existentes={presupuestos.map(p => p.categoriaId)}
        t={t}
        dark={dark}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 22, paddingTop: 14, paddingBottom: 14 },
  eyebrow: { fontSize: 10.5, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: '600', fontFamily: fonts.ui, marginBottom: 2 },
  heading: { fontFamily: fonts.display, fontStyle: 'italic', fontWeight: '400', fontSize: 34, lineHeight: 36, letterSpacing: -1 },
  scroll: { paddingBottom: 40 },
  resumen: { flexDirection: 'row', alignItems: 'center', gap: 18, marginHorizontal: 22, marginBottom: 16, padding: 18, borderRadius: 16, borderWidth: 1 },
  resumenEyebrow: { fontSize: 11, letterSpacing: 0.4, textTransform: 'uppercase', fontFamily: fonts.ui },
  resumenGs:    { fontFamily: fonts.display, fontStyle: 'italic', fontSize: 20 },
  resumenMonto: { fontFamily: fonts.mono, fontSize: 28, fontWeight: '700', letterSpacing: -0.8 },
  resumenSub:   { fontSize: 11, marginTop: 2, fontFamily: fonts.ui },
  tabs: { flexDirection: 'row', gap: 6, paddingHorizontal: 22, marginBottom: 14 },
  tab:  { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10 },
  tabTxt:      { fontSize: 12, fontWeight: '500', fontFamily: fonts.ui },
  tabBadge:    { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999 },
  tabBadgeTxt: { fontSize: 11, fontWeight: '600', fontFamily: fonts.ui },
  grid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 22 },
  gridItem: { width: '47.5%' },
  emptyBox: { marginHorizontal: 22, padding: 28, borderRadius: br.lg, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center' },
  emptyTxt: { fontSize: 13, lineHeight: 20, textAlign: 'center', fontFamily: fonts.ui },
  addDash:  { marginHorizontal: 22, marginTop: 14, padding: 14, borderRadius: br.lg, borderWidth: 1, borderStyle: 'dashed', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  addDashTxt: { fontSize: 13, fontWeight: '500', fontFamily: fonts.ui },
});
