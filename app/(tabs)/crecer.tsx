/**
 * (tabs)/crecer.tsx
 * Responsabilidad: Metas de ahorro (Crecé) y resumen de presupuestos
 * Usado por: expo-router (tab)
 * Depende de: metas, budgets, celebracion
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, Alert, Animated, Easing,
  TextInput, Keyboard,
} from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import Svg, { Path, Circle, Rect, Line, Polyline, G } from 'react-native-svg';
import { useThemeCtx } from '@/services/ThemeContext';
import {
  getMetas, deleteMeta, getTotalAhorradoEnMetas, agregarAhorroAMeta, updateMeta,
  type Meta, type TipoMeta,
} from '@/services/metas';
import { getPresupuestosConGasto, type PresupuestoConGasto } from '@/services/budgets';
import { localDateKey } from '@/services/dateKeys';
import { CATEGORIA_POR_ID } from '@/constants/categories';
import { EmptyState } from '@/components/EmptyState';
import { InlineError } from '@/components/InlineError';
import { Skeleton, SkeletonRows } from '@/components/Skeleton';
import { colors, colorsDark, fonts, borderRadius as br, iconStroke, hit, motion } from '@/theme/design-system';

function fmtGs(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString('es-PY');
}

function fmtGsFull(n: number): string {
  return n.toLocaleString('es-PY').replace(/,/g, '.');
}

function parseGs(v: string): number {
  return parseInt(v.replace(/\D/g, ''), 10) || 0;
}

function formatGs(n: number): string {
  if (n === 0) return '';
  return n.toLocaleString('es-PY').replace(/,/g, '.');
}

type IconName =
  | 'briefcase' | 'home' | 'shield' | 'credit-card' | 'sparkles'
  | 'plus' | 'check' | 'x' | 'calendar' | 'trend-up' | 'lock'
  | 'arrow-right' | 'trash' | 'shopping-cart' | 'pie' | 'bell'
  | 'car' | 'cutlery' | 'bolt' | 'gas' | 'phone' | 'pill'
  | 'shirt' | 'heart' | 'cash' | 'music' | 'book' | 'chart';

function Icon({ name, size = 20, color, strokeWidth = iconStroke }: {
  name: IconName; size?: number; color?: string; strokeWidth?: number;
}) {
  const { dark } = useThemeCtx();
  const c = color ?? (dark ? colorsDark : colors).ink;
  const sw = { stroke: c, strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  const icons: Partial<Record<IconName, React.ReactNode>> = {
    'briefcase':     <><Rect x="3" y="8" width="18" height="13" rx="2" {...sw} /><Path {...sw} d="M8 8V5a2 2 0 012-2h4a2 2 0 012 2v3" /></>,
    'home':          <Path {...sw} d="M3 11l9-7 9 7v9h-6v-6h-6v6H3z" />,
    'shield':        <Path {...sw} d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
    'credit-card':   <><Rect x="1" y="4" width="22" height="16" rx="2" {...sw} /><Line x1="1" y1="10" x2="23" y2="10" {...sw} /></>,
    'sparkles':      <Path {...sw} d="M5 3v4M3 5h4M19 3v4M17 5h4M12 3v2M10 12h4M12 17v2M8 12a4 4 0 008 0" />,
    'plus':          <><Line x1="12" y1="5" x2="12" y2="19" {...sw} /><Line x1="5" y1="12" x2="19" y2="12" {...sw} /></>,
    'check':         <Path {...sw} d="M20 6L9 17l-5-5" />,
    'x':             <><Line x1="18" y1="6" x2="6" y2="18" {...sw} /><Line x1="6" y1="6" x2="18" y2="18" {...sw} /></>,
    'calendar':      <><Rect x="3" y="4" width="18" height="18" rx="2" {...sw} /><Path {...sw} d="M16 2v4M8 2v4M3 10h18" /></>,
    'trend-up':      <><Polyline {...sw} points="23 6 13.5 15.5 8.5 10.5 1 18" /><Polyline {...sw} points="17 6 23 6 23 12" /></>,
    'lock':          <><Rect x="3" y="11" width="18" height="11" rx="2" {...sw} /><Path {...sw} d="M7 11V7a5 5 0 0110 0v4" /></>,
    'arrow-right':   <Path {...sw} d="M5 12h14M12 5l7 7-7 7" />,
    'trash':         <Path {...sw} d="M3 6h18M19 6l-1 14H6L5 6M9 6V4h6v2" />,
    'shopping-cart': <><Circle cx="9" cy="21" r="1" fill={c} stroke="none" /><Circle cx="20" cy="21" r="1" fill={c} stroke="none" /><Path {...sw} d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" /></>,
    'pie':           <><Path {...sw} d="M12 3v9h9a9 9 0 11-9-9z" /><Path {...sw} d="M14 3a7 7 0 017 7h-7V3z" /></>,
    'bell':          <Path {...sw} d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />,
    'car':           <><Path {...sw} d="M5 17H3a2 2 0 01-2-2V9a2 2 0 012-2h16a2 2 0 012 2v6a2 2 0 01-2 2h-2M5 17h14M7 17v2M17 17v2" /><Path {...sw} d="M5 9l2-4h10l2 4" /></>,
    'cutlery':       <Path {...sw} d="M3 3v6a3 3 0 006 0V3M6 3v18M21 15V2a5 5 0 00-5 5v6c0 1.1.9 2 2 2h3zm0 0v7" />,
    'bolt':          <Path {...sw} d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />,
    'gas':           <><Path {...sw} d="M4 22V8a2 2 0 012-2h8a2 2 0 012 2v14M2 22h18" /><Path {...sw} d="M16 8h2a2 2 0 012 2v4a2 2 0 002 2h0" /><Line x1="8" y1="8" x2="12" y2="8" {...sw} /></>,
    'phone':         <Path {...sw} d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />,
    'pill':          <><Line x1="6" y1="6" x2="18" y2="18" {...sw} /><Path {...sw} d="M4.93 4.93a7 7 0 109.9 9.9" /></>,
    'shirt':         <Path {...sw} d="M20.38 3.46L16 2a4 4 0 01-8 0L3.62 3.46a2 2 0 00-1.34 2.23l.58 3.57a1 1 0 00.99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 002-2V10h2.15a1 1 0 00.99-.84l.58-3.57a2 2 0 00-1.34-2.23z" />,
    'heart':         <Path {...sw} d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />,
    'cash':          <><Rect x="2" y="6" width="20" height="12" rx="2" {...sw} /><Circle cx="12" cy="12" r="3" {...sw} /><Path {...sw} d="M6 12h.01M18 12h.01" /></>,
    'music':         <><Path {...sw} d="M9 18V5l12-2v13" /><Circle cx="6" cy="18" r="3" {...sw} /><Circle cx="18" cy="16" r="3" {...sw} /></>,
    'book':          <><Path {...sw} d="M4 19.5A2.5 2.5 0 016.5 17H20" /><Path {...sw} d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" /></>,
    'chart':         <Path {...sw} d="M18 20V10M12 20V4M6 20v-6" />,
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {icons[name] ?? icons['sparkles']}
    </Svg>
  );
}

function catIcon(icono: string): IconName {
  const map: Record<string, IconName> = {
    'shopping-cart': 'shopping-cart', 'cutlery': 'cutlery', 'gas': 'gas',
    'car': 'car', 'bolt': 'bolt', 'phone': 'phone', 'pill': 'pill',
    'shirt': 'shirt', 'home': 'home', 'music': 'music', 'cash': 'cash',
    'credit-card': 'credit-card', 'book': 'book', 'heart': 'heart',
    'chart': 'chart', 'briefcase': 'briefcase', 'trend-up': 'trend-up',
    'shield': 'shield',
  };
  return (map[icono] ?? 'sparkles') as IconName;
}

const META_ICONOS: Record<string, IconName> = {
  briefcase: 'briefcase', home: 'home', shield: 'shield',
  'credit-card': 'credit-card', sparkles: 'sparkles',
  'trend-up': 'trend-up', pie: 'pie',
};

function FadeSlideIn({ children, delay = 0, style }: {
  children: React.ReactNode; delay?: number; style?: any;
}) {
  const reduce = useReducedMotion();
  const anim = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  useEffect(() => {
    if (reduce) return;
    Animated.timing(anim, {
      toValue: 1, duration: motion.base, delay,
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

function pctDe(meta: Meta): number {
  return meta.metaMonto > 0 ? Math.min(100, Math.round((meta.actualMonto / meta.metaMonto) * 100)) : 0;
}

interface GoalRowProps {
  meta: Meta;
  t: typeof colors;
  onPress: () => void;
  onAvisosPress: () => void;
}

function GoalRow({ meta, t, onPress, onAvisosPress }: GoalRowProps) {
  const pct = pctDe(meta);
  const vencida = meta.diasRestantes <= 0;
  const completa = pct >= 100;
  const colorDias = vencida && !completa ? t.negative : t.muteText;
  const labelDias = completa
    ? 'Meta cumplida'
    : vencida
    ? 'Vencida'
    : meta.diasRestantes == null
    ? 'Sin fecha límite'
    : `${meta.diasRestantes} días restantes`;
  const barColor = completa ? t.positive : t.accent;
  const iconName = META_ICONOS[meta.icono] ?? 'sparkles';

  return (
    <View style={gr.row}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        style={gr.main}
        accessibilityRole="button"
        accessibilityLabel={`${meta.titulo}, ${pct} por ciento, ${fmtGsFull(meta.actualMonto)} de ${fmtGsFull(meta.metaMonto)} guaraníes. ${labelDias}. Tocá para agregar ahorro`}
      >
        <View style={[gr.iconBox, { backgroundColor: t.accentBg }]}>
          <Icon name={iconName} size={20} color={t.accent} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={gr.line}>
            <Text style={[gr.titulo, { color: t.ink }]} numberOfLines={1}>{meta.titulo}</Text>
            <Text style={[gr.pct, { color: completa ? t.positive : t.ink }]}>{pct}%</Text>
          </View>
          <View style={[gr.track, { backgroundColor: t.hairline }]}>
            <View style={[gr.fill, { width: `${pct}%`, backgroundColor: barColor }]} />
          </View>
          <View style={gr.line}>
            <Text style={[gr.monto, { color: t.ink2 }]}>Gs {fmtGs(meta.actualMonto)} / {fmtGs(meta.metaMonto)}</Text>
            <Text style={[gr.dias, { color: colorDias }]}>{labelDias}</Text>
          </View>
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={onAvisosPress}
        activeOpacity={0.7}
        hitSlop={hit}
        style={gr.bell}
        accessibilityRole="button"
        accessibilityLabel={meta.notifCount > 0 ? `Avisos de ${meta.titulo}, ${meta.notifCount} activos` : `Avisos de ${meta.titulo}`}
      >
        <Icon name="bell" size={20} color={meta.notifCount > 0 ? t.warn : t.muteText} />
      </TouchableOpacity>
    </View>
  );
}

const gr = StyleSheet.create({
  row:    { flexDirection: 'row', alignItems: 'center', minHeight: 72 },
  main:   { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  iconBox: { width: 44, height: 44, borderRadius: br.md, alignItems: 'center', justifyContent: 'center' },
  line:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  titulo: { fontSize: 15, fontWeight: '600', flex: 1, fontFamily: fonts.ui },
  pct:    { fontSize: 15, fontWeight: '700', fontFamily: fonts.mono, fontVariant: ['tabular-nums'] },
  track:  { height: 6, borderRadius: 3, marginVertical: 8, overflow: 'hidden' },
  fill:   { height: '100%', borderRadius: 3 },
  monto:  { fontFamily: fonts.mono, fontSize: 12, fontVariant: ['tabular-nums'] },
  dias:   { fontSize: 12, fontFamily: fonts.ui },
  bell:   { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});

function Sheet({ visible, onClose, t, children }: {
  visible: boolean; onClose: () => void; t: typeof colors; children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity
        style={{ flex: 1, backgroundColor: t.scrim }}
        activeOpacity={1}
        onPress={onClose}
        accessibilityLabel="Cerrar"
        accessibilityRole="button"
      />
      <View style={[sh.sheet, { backgroundColor: t.bg, paddingBottom: insets.bottom + 24 }]}>
        <View style={[sh.pill, { backgroundColor: t.hairline }]} />
        {children}
      </View>
    </Modal>
  );
}

const sh = StyleSheet.create({
  sheet: { borderTopLeftRadius: br.xl, borderTopRightRadius: br.xl, paddingHorizontal: 24, paddingTop: 12 },
  pill:  { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
});

function CloseBtn({ onPress, t }: { onPress: () => void; t: typeof colors }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -12 }}
      accessibilityRole="button"
      accessibilityLabel="Cerrar"
    >
      <Icon name="x" size={20} color={t.ink2} />
    </TouchableOpacity>
  );
}

const TIPOS: { id: TipoMeta; titulo: string; desc: string; icon: IconName }[] = [
  { id: 'solo',  titulo: 'Solo',        desc: 'Solo para vos.',           icon: 'home' },
  { id: 'grupo', titulo: 'Grupo',       desc: 'Compartida con otros.',    icon: 'briefcase' },
  { id: 'fijo',  titulo: 'Fijo',        desc: 'Monto exacto, con fecha.', icon: 'lock' },
  { id: 'largo', titulo: 'Largo plazo', desc: 'Más de 1 año.',            icon: 'trend-up' },
];

function MetaTipoModal({ visible, onClose, t, initialTipo }: {
  visible: boolean; onClose: () => void; t: typeof colors; initialTipo?: TipoMeta;
}) {
  const [sel, setSel] = useState<TipoMeta>(initialTipo ?? 'solo');
  const router = useRouter();

  useEffect(() => { if (visible) setSel(initialTipo ?? 'solo'); }, [visible, initialTipo]);

  function continuar() {
    onClose();
    router.push({ pathname: '/meta/nueva', params: { tipo: sel } } as any);
  }

  return (
    <Sheet visible={visible} onClose={onClose} t={t}>
      <View style={mt.hdr}>
        <View style={{ flex: 1 }}>
          <Text style={[mt.heading, { color: t.ink }]}>¿Qué tipo de meta?</Text>
          <Text style={[mt.sub, { color: t.ink2 }]}>Elegí cómo querés ahorrar.</Text>
        </View>
        <CloseBtn onPress={onClose} t={t} />
      </View>
      <View style={mt.list}>
        {TIPOS.map(tp => {
          const on = sel === tp.id;
          return (
            <TouchableOpacity
              key={tp.id}
              style={[mt.item, { backgroundColor: on ? t.accentBg : 'transparent', borderColor: on ? t.accent : t.hairline }]}
              onPress={() => setSel(tp.id)}
              activeOpacity={0.75}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${tp.titulo}. ${tp.desc}`}
            >
              <Icon name={tp.icon} size={20} color={on ? t.accent : t.ink2} />
              <View style={{ flex: 1 }}>
                <Text style={[mt.itemTitulo, { color: t.ink }]}>{tp.titulo}</Text>
                <Text style={[mt.itemDesc, { color: t.ink2 }]}>{tp.desc}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
      <TouchableOpacity
        style={[mt.btn, { backgroundColor: t.accent }]}
        onPress={continuar}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Continuar"
      >
        <Text style={[mt.btnTxt, { color: t.onAccent }]}>Continuar</Text>
        <Icon name="arrow-right" size={18} color={t.onAccent} />
      </TouchableOpacity>
    </Sheet>
  );
}

const mt = StyleSheet.create({
  hdr:       { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  heading:   { fontFamily: fonts.display, fontStyle: 'italic', fontSize: 24, lineHeight: 28, fontWeight: '400' },
  sub:       { fontSize: 14, lineHeight: 20, fontFamily: fonts.ui, marginTop: 4 },
  list:      { gap: 8, marginBottom: 24 },
  item:      { minHeight: 64, paddingHorizontal: 16, paddingVertical: 12, borderRadius: br.lg, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  itemTitulo: { fontSize: 15, fontWeight: '600', fontFamily: fonts.ui },
  itemDesc:  { fontSize: 13, marginTop: 2, fontFamily: fonts.ui },
  btn:       { minHeight: 52, borderRadius: br.lg, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  btnTxt:    { fontSize: 16, fontWeight: '600', fontFamily: fonts.ui },
});

const AVISO_TIPOS = [
  { ico: 'bell' as IconName,      titulo: 'Sin actividad por 7 días',    desc: 'Te recordamos agregar ahorro si no hubo movimiento reciente.' },
  { ico: 'calendar' as IconName,  titulo: 'A 7 días del vencimiento',    desc: 'Alerta antes de que se cumpla la fecha límite de la meta.' },
  { ico: 'trend-up' as IconName,  titulo: 'Hito alcanzado (50% / 80%)',  desc: 'Notificación cuando llegás a un porcentaje clave del objetivo.' },
  { ico: 'check' as IconName,     titulo: 'Meta completada',             desc: 'Celebración cuando alcanzás el 100% de tu objetivo.' },
];

function AvisoSheet({ meta, visible, onClose, onRead, t }: {
  meta: Meta | null; visible: boolean; onClose: () => void; onRead: () => void;
  t: typeof colors;
}) {
  const router = useRouter();

  if (!meta) return null;

  const n         = Math.min(meta.notifCount, AVISO_TIPOS.length);
  const mostrar   = AVISO_TIPOS.slice(0, Math.max(n, 1));
  const esSistema = meta.notifCount > 0;

  function handleClose() {
    if (esSistema) onRead();
    onClose();
  }

  return (
    <Sheet visible={visible} onClose={handleClose} t={t}>
      <View style={avs.hdrRow}>
        <View style={{ flex: 1 }}>
          <Text style={[avs.eyebrow, { color: t.muteText }]}>Avisos de meta</Text>
          <Text style={[avs.titulo, { color: t.ink }]} numberOfLines={1}>{meta.titulo}</Text>
        </View>
        <CloseBtn onPress={handleClose} t={t} />
      </View>

      <Text style={[avs.count, { color: t.ink2 }]}>
        <Text style={{ color: t.warn, fontFamily: fonts.mono, fontWeight: '700' }}>{meta.notifCount}</Text>
        {` aviso${meta.notifCount !== 1 ? 's' : ''} activo${meta.notifCount !== 1 ? 's' : ''}, ${esSistema ? 'configurados por el sistema' : 'ninguno activo aún'}`}
      </Text>

      <View style={{ marginBottom: 16 }}>
        {mostrar.map((a, i) => (
          <View key={i} style={avs.avisoRow}>
            <Icon name={a.ico} size={20} color={i < n ? t.warn : t.muteText} />
            <View style={{ flex: 1 }}>
              <Text style={[avs.avTitulo, { color: i < n ? t.ink : t.ink2 }]}>{a.titulo}</Text>
              <Text style={[avs.avDesc, { color: t.ink2 }]} numberOfLines={2}>{a.desc}</Text>
            </View>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={[avs.btnLink, { backgroundColor: t.accentBg }]}
        onPress={() => { handleClose(); setTimeout(() => router.push('/recordatorios' as any), motion.slow); }}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel="Gestionar recordatorios"
      >
        <Text style={[avs.btnLinkTxt, { color: t.accent }]}>Gestionar recordatorios</Text>
        <Icon name="arrow-right" size={18} color={t.accent} />
      </TouchableOpacity>
    </Sheet>
  );
}

const avs = StyleSheet.create({
  hdrRow:    { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  eyebrow:   { fontSize: 11, letterSpacing: 1.1, textTransform: 'uppercase', fontWeight: '600', fontFamily: fonts.ui },
  titulo:    { fontSize: 17, fontWeight: '600', fontFamily: fonts.ui, marginTop: 2 },
  count:     { fontSize: 14, lineHeight: 20, fontFamily: fonts.ui, marginBottom: 16 },
  avisoRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12 },
  avTitulo:  { fontSize: 14, fontWeight: '600', fontFamily: fonts.ui },
  avDesc:    { fontSize: 13, fontFamily: fonts.ui, marginTop: 2, lineHeight: 18 },
  btnLink:   { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: br.lg },
  btnLinkTxt: { fontSize: 15, fontWeight: '600', fontFamily: fonts.ui },
});

function GoalActionSheet({ meta, visible, onClose, t, onEdit, onDelete, onSaved, onCompleted }: {
  meta: Meta | null; visible: boolean; onClose: () => void;
  t: typeof colors;
  onEdit: () => void; onDelete: () => void; onSaved: () => void;
  onCompleted: (titulo: string, monto: number) => void;
}) {
  const [str, setStr] = useState('');
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null);
  const num = parseGs(str);

  useEffect(() => { if (!visible) { setStr(''); setErrorGuardar(null); } }, [visible]);

  if (!meta) return null;

  const pct = pctDe(meta);
  const iconName = META_ICONOS[meta.icono] ?? 'sparkles';

  function guardar() {
    if (num <= 0 || !meta) return;
    try {
      const completaba = meta.metaMonto > 0 && meta.actualMonto >= meta.metaMonto;
      const completa = meta.metaMonto > 0 && meta.actualMonto + num >= meta.metaMonto;
      agregarAhorroAMeta(meta.id, num);
      Keyboard.dismiss();
      onSaved();
      onClose();
      if (completa && !completaba) {
        setTimeout(() => onCompleted(meta.titulo, meta.metaMonto), motion.slow);
      }
    } catch {
      setErrorGuardar('No pudimos guardar el ahorro. Probá de nuevo.');
    }
  }

  function confirmarEliminar() {
    if (!meta) return;
    onClose();
    setTimeout(() => {
      Alert.alert('Eliminar meta', `¿Eliminar "${meta.titulo}"?`, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: onDelete },
      ]);
    }, motion.slow);
  }

  return (
    <Sheet visible={visible} onClose={() => { Keyboard.dismiss(); onClose(); }} t={t}>
      <View style={gas.hdr}>
        <View style={[gas.iconBox, { backgroundColor: t.accentBg }]}>
          <Icon name={iconName} size={20} color={t.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[gas.titulo, { color: t.ink }]} numberOfLines={1}>{meta.titulo}</Text>
          <Text style={[gas.monto, { color: t.ink2 }]}>Gs {fmtGs(meta.actualMonto)} / Gs {fmtGs(meta.metaMonto)}</Text>
        </View>
        <Text style={[gas.pct, { color: t.ink }]}>{pct}%</Text>
      </View>

      <View style={[gas.track, { backgroundColor: t.hairline }]}>
        <View style={[gas.fill, { width: `${pct}%`, backgroundColor: pct >= 100 ? t.positive : t.accent }]} />
      </View>

      <Text style={[gas.label, { color: t.muteText }]}>Agregar ahorro</Text>
      <View style={[gas.inputRow, { backgroundColor: t.card, borderColor: t.hairline }]}>
        <Text style={[gas.inputPfx, { color: t.ink2 }]}>Gs</Text>
        <TextInput
          style={[gas.input, { color: t.ink }]}
          value={str}
          onChangeText={v => { setStr(formatGs(parseGs(v))); setErrorGuardar(null); }}
          placeholder="0"
          placeholderTextColor={t.muteText}
          keyboardType="number-pad"
          accessibilityLabel="Monto a ahorrar en guaraníes"
        />
      </View>

      {errorGuardar && <View style={{ marginBottom: 12 }}><InlineError mensaje={errorGuardar} /></View>}

      <TouchableOpacity
        style={[gas.btnP, { backgroundColor: t.accent, opacity: num > 0 ? 1 : 0.4 }]}
        onPress={guardar} disabled={num <= 0} activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityState={{ disabled: num <= 0 }}
        accessibilityLabel="Guardar ahorro"
      >
        <Text style={[gas.btnPTxt, { color: t.onAccent }]}>Guardar ahorro</Text>
      </TouchableOpacity>

      <View style={[gas.sep, { backgroundColor: t.hairline }]} />

      <TouchableOpacity
        style={gas.btnS}
        onPress={() => { onClose(); setTimeout(onEdit, motion.slow); }}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Editar meta"
      >
        <Text style={[gas.btnSTxt, { color: t.ink }]}>Editar meta</Text>
        <Icon name="arrow-right" size={18} color={t.muteText} />
      </TouchableOpacity>

      <TouchableOpacity
        style={gas.btnS}
        onPress={confirmarEliminar}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Eliminar esta meta"
      >
        <Text style={[gas.btnSTxt, { color: t.negative }]}>Eliminar esta meta</Text>
        <Icon name="trash" size={18} color={t.negative} />
      </TouchableOpacity>
    </Sheet>
  );
}

const gas = StyleSheet.create({
  hdr:      { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  iconBox:  { width: 44, height: 44, borderRadius: br.md, alignItems: 'center', justifyContent: 'center' },
  titulo:   { fontSize: 16, fontWeight: '600', fontFamily: fonts.ui },
  monto:    { fontSize: 13, fontFamily: fonts.mono, marginTop: 2, fontVariant: ['tabular-nums'] },
  pct:      { fontSize: 18, fontWeight: '700', fontFamily: fonts.mono, fontVariant: ['tabular-nums'] },
  track:    { height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 24 },
  fill:     { height: '100%', borderRadius: 3 },
  label:    { fontSize: 11, letterSpacing: 1.1, textTransform: 'uppercase', fontWeight: '600', fontFamily: fonts.ui, marginBottom: 8 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: br.md, borderWidth: 1, paddingHorizontal: 16, height: 52, marginBottom: 16 },
  inputPfx: { fontFamily: fonts.display, fontStyle: 'italic', fontSize: 18 },
  input:    { flex: 1, fontSize: 20, fontFamily: fonts.mono, paddingVertical: 0, fontVariant: ['tabular-nums'] },
  btnP:     { minHeight: 52, borderRadius: br.lg, alignItems: 'center', justifyContent: 'center' },
  btnPTxt:  { fontSize: 16, fontWeight: '600', fontFamily: fonts.ui },
  sep:      { height: StyleSheet.hairlineWidth, marginVertical: 16 },
  btnS:     { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  btnSTxt:  { fontSize: 15, fontWeight: '500', fontFamily: fonts.ui },
});

function SummaryRing({ total, metas, pctTotal, t }: {
  total: number; metas: number; pctTotal: number; t: typeof colors;
}) {
  const R      = 28;
  const circ   = 2 * Math.PI * R;
  const filled = (pctTotal / 100) * circ;
  const mesLabel = new Date().toLocaleDateString('es-PY', { month: 'long', year: 'numeric' });

  return (
    <View
      style={sc.row}
      accessible
      accessibilityLabel={`Ahorrado en metas: ${fmtGsFull(total)} guaraníes, ${pctTotal} por ciento del objetivo total`}
    >
      <View style={{ flex: 1 }}>
        <Text style={[sc.eyebrow, { color: t.muteText }]}>Ahorrado en metas</Text>
        <Text style={[sc.monto, { color: t.ink }]}>Gs {fmtGsFull(total)}</Text>
        <Text style={[sc.sub, { color: t.ink2 }]}>
          {metas} meta{metas !== 1 ? 's' : ''} · {mesLabel}
        </Text>
      </View>
      <View style={sc.ringWrap}>
        <Svg width={68} height={68} viewBox="0 0 68 68">
          <G rotation="-90" origin="34, 34">
            <Circle cx="34" cy="34" r={R} fill="none" stroke={t.hairline} strokeWidth={6} />
            <Circle
              cx="34" cy="34" r={R} fill="none"
              stroke={t.accent} strokeWidth={6}
              strokeDasharray={[filled, circ]}
              strokeLinecap="round"
            />
          </G>
        </Svg>
        <View style={sc.ringLabel}>
          <Text style={[sc.ringPct, { color: t.ink }]}>{pctTotal}%</Text>
        </View>
      </View>
    </View>
  );
}

const sc = StyleSheet.create({
  row:       { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 24, marginBottom: 24 },
  eyebrow:   { fontSize: 11, letterSpacing: 1.1, textTransform: 'uppercase', fontWeight: '600', fontFamily: fonts.ui, marginBottom: 4 },
  monto:     { fontFamily: fonts.mono, fontSize: 32, fontWeight: '600', letterSpacing: -1, marginBottom: 4, fontVariant: ['tabular-nums'] },
  sub:       { fontSize: 13, fontFamily: fonts.ui },
  ringWrap:  { position: 'relative', width: 68, height: 68 },
  ringLabel: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  ringPct:   { fontSize: 13, fontWeight: '700', fontFamily: fonts.mono },
});

function PresupuestosList({ presupuestos, t }: {
  presupuestos: PresupuestoConGasto[];
  t: typeof colors;
}) {
  const router   = useRouter();
  const items    = presupuestos.slice(0, 4);
  const mesLabel = new Date().toLocaleDateString('es-PY', { month: 'long' });

  return (
    <View style={pg.wrap}>
      <View style={pg.hdr}>
        <Text style={[pg.title, { color: t.ink }]}>Presupuestos de {mesLabel}</Text>
        <TouchableOpacity
          style={pg.linkBtn}
          onPress={() => router.push('/presupuestos' as any)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Ver todos los presupuestos"
        >
          <Text style={[pg.link, { color: t.accent }]}>Ver todo</Text>
        </TouchableOpacity>
      </View>
      {items.map(p => {
        const cat      = CATEGORIA_POR_ID[p.categoriaId];
        const tinte    = cat?.tinte ?? t.muted;
        const over     = p.excedido;
        const restante = over ? p.exceso : p.restante;
        return (
          <View
            key={p.id}
            style={pg.row}
            accessible
            accessibilityLabel={`${cat?.nombre ?? p.categoriaId}: ${p.pct} por ciento usado, ${over ? 'excedido por' : 'restan'} ${fmtGsFull(restante)} guaraníes`}
          >
            <View style={[pg.catIco, { backgroundColor: t.accentBg }]}>
              <Icon name={catIcon(cat?.icono ?? '')} size={18} color={tinte} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={pg.line}>
                <Text style={[pg.catName, { color: t.ink }]} numberOfLines={1}>{cat?.nombre ?? p.categoriaId}</Text>
                <Text style={[pg.pct, { color: over ? t.negative : t.ink2 }]}>{p.pct}%</Text>
              </View>
              <View style={[pg.bar, { backgroundColor: t.hairline }]}>
                <View style={[pg.barFill, { width: `${Math.min(100, p.pct)}%`, backgroundColor: over ? t.negative : tinte }]} />
              </View>
              <Text style={[pg.rest, { color: over ? t.negative : t.ink2 }]}>
                {over ? `Excedido por Gs ${fmtGs(restante)}` : `Quedan Gs ${fmtGs(restante)}`}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const pg = StyleSheet.create({
  wrap:    { paddingHorizontal: 24 },
  hdr:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, minHeight: 44 },
  title:   { fontSize: 17, fontWeight: '600', fontFamily: fonts.ui },
  linkBtn: { minHeight: 44, justifyContent: 'center' },
  link:    { fontSize: 14, fontFamily: fonts.ui, fontWeight: '600' },
  row:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  catIco:  { width: 40, height: 40, borderRadius: br.md, alignItems: 'center', justifyContent: 'center' },
  line:    { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  catName: { fontSize: 14, fontWeight: '500', fontFamily: fonts.ui, flex: 1 },
  pct:     { fontSize: 13, fontWeight: '600', fontFamily: fonts.mono, fontVariant: ['tabular-nums'] },
  bar:     { height: 6, borderRadius: 3, overflow: 'hidden', marginVertical: 6 },
  barFill: { height: '100%', borderRadius: 3 },
  rest:    { fontSize: 12, fontFamily: fonts.mono, fontVariant: ['tabular-nums'] },
});

export default function CrecerScreen() {
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;
  const router  = useRouter();
  const insets  = useSafeAreaInsets();

  const [metas, setMetas]               = useState<Meta[]>([]);
  const [presupuestos, setPresupuestos] = useState<PresupuestoConGasto[]>([]);
  const [cargando, setCargando]         = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [tab, setTab]                   = useState<'mias' | 'grupo'>('mias');
  const [showModal, setShowModal]       = useState(false);
  const [modalTipo, setModalTipo]       = useState<TipoMeta | undefined>(undefined);
  const [totalAhorro, setTotalAhorro]   = useState(0);
  const [actionMeta, setActionMeta]     = useState<Meta | null>(null);
  const [avisoMeta, setAvisoMeta]       = useState<Meta | null>(null);

  const cargar = useCallback(() => {
    const mesKey = localDateKey().slice(0, 7);
    setError(null);
    try {
      setMetas(getMetas());
      setTotalAhorro(getTotalAhorradoEnMetas());
      setPresupuestos(getPresupuestosConGasto(mesKey));
    } catch (e) {
      console.error('Crecer error:', e);
      setError('No pudimos cargar tus metas.');
    } finally {
      setCargando(false);
    }
  }, []);

  useFocusEffect(cargar);

  const metasFiltradas = metas.filter(m => tab === 'mias' ? !m.esGrupo : m.esGrupo);
  const totalTarget    = metas.reduce((sum, m) => sum + m.metaMonto, 0);
  const pctTotal       = totalTarget > 0 ? Math.min(100, Math.round((totalAhorro / totalTarget) * 100)) : 0;

  function abrirNueva(tipo?: TipoMeta) {
    setModalTipo(tipo);
    setShowModal(true);
  }

  function celebrar(titulo: string, monto: number) {
    router.push({ pathname: '/celebracion', params: { titulo, monto: String(monto) } } as any);
  }

  if (cargando) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
        <View style={{ padding: 24, gap: 24 }} accessibilityLabel="Cargando metas">
          <Skeleton width={140} height={32} />
          <Skeleton width={220} height={40} radius={br.md} />
          <SkeletonRows count={3} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 48 }}
      >
        <View style={s.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={[s.eyebrow, { color: t.muteText }]}>Crecé</Text>
            <Text style={[s.heading, { color: t.ink }]}>Tus metas</Text>
          </View>
          <TouchableOpacity
            style={[s.btnNueva, { backgroundColor: t.accent }]}
            onPress={() => abrirNueva()}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Crear una meta nueva"
          >
            <Icon name="plus" size={16} color={t.onAccent} strokeWidth={2} />
            <Text style={[s.btnNuevaTxt, { color: t.onAccent }]}>Nueva</Text>
          </TouchableOpacity>
        </View>

        {error && (
          <View style={{ paddingHorizontal: 24, marginBottom: 16 }}>
            <InlineError mensaje={error} onReintentar={cargar} />
          </View>
        )}

        {metas.length > 0 && (
          <FadeSlideIn delay={0}>
            <SummaryRing total={totalAhorro} metas={metas.length} pctTotal={pctTotal} t={t} />
          </FadeSlideIn>
        )}

        {metas.length > 0 && (
          <View style={s.tabs} accessibilityRole="tablist">
            {([
              ['mias',  'Mis metas',   metas.filter(m => !m.esGrupo).length],
              ['grupo', 'Compartidas', metas.filter(m =>  m.esGrupo).length],
            ] as [typeof tab, string, number][]).map(([k, l, n]) => (
              <TouchableOpacity
                key={k}
                style={[s.tab, { backgroundColor: tab === k ? t.accentBg : 'transparent' }]}
                onPress={() => setTab(k)}
                activeOpacity={0.75}
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === k }}
                accessibilityLabel={`${l}, ${n}`}
              >
                <Text style={[s.tabTxt, { color: tab === k ? t.accent : t.ink2 }]}>{l}</Text>
                <Text style={[s.tabBadgeTxt, { color: tab === k ? t.accent : t.muteText }]}>{n}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={s.list}>
          {metas.length === 0 ? (
            <EmptyState
              titulo="Empezá a crecer"
              texto="Creá una meta de ahorro, por ejemplo un fondo de emergencia, y seguí tu avance acá."
              accion="Crear mi primera meta"
              onAccion={() => abrirNueva()}
            />
          ) : metasFiltradas.length === 0 ? (
            <EmptyState
              titulo={tab === 'mias' ? 'No tenés metas personales' : 'No tenés metas compartidas'}
              texto="Creá una nueva meta para empezar a ahorrar."
              accion="Nueva meta"
              onAccion={() => abrirNueva(tab === 'grupo' ? 'grupo' : 'solo')}
            />
          ) : (
            metasFiltradas.map((m, i) => (
              <FadeSlideIn key={m.id} delay={i * 60}>
                <GoalRow
                  meta={m}
                  t={t}
                  onPress={() => setActionMeta(m)}
                  onAvisosPress={() => setAvisoMeta(m)}
                />
                {i < metasFiltradas.length - 1 && <View style={[s.divider, { backgroundColor: t.hairline }]} />}
              </FadeSlideIn>
            ))
          )}
        </View>

        <View style={{ marginTop: 32 }}>
          {presupuestos.length > 0 ? (
            <PresupuestosList presupuestos={presupuestos} t={t} />
          ) : (
            <View style={{ paddingHorizontal: 24 }}>
              <Text style={[s.secTitulo, { color: t.ink }]}>Presupuestos</Text>
              <Text style={[s.secTxt, { color: t.ink2 }]}>
                Poné un tope mensual por categoría y mirá cuánto te queda.
              </Text>
              <TouchableOpacity
                style={[s.secBtn, { backgroundColor: t.accentBg }]}
                onPress={() => router.push('/presupuestos' as any)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Crear un presupuesto"
              >
                <Text style={[s.secBtnTxt, { color: t.accent }]}>Crear un presupuesto</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      <MetaTipoModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        t={t}
        initialTipo={modalTipo}
      />

      <AvisoSheet
        meta={avisoMeta}
        visible={avisoMeta !== null}
        onClose={() => setAvisoMeta(null)}
        onRead={() => {
          if (avisoMeta) {
            updateMeta(avisoMeta.id, { notifCount: 0 });
            cargar();
          }
        }}
        t={t}
      />

      <GoalActionSheet
        meta={actionMeta}
        visible={actionMeta !== null}
        onClose={() => setActionMeta(null)}
        t={t}
        onEdit={() => router.push({ pathname: '/meta/nueva', params: { id: actionMeta?.id } } as any)}
        onDelete={() => { if (actionMeta) { deleteMeta(actionMeta.id); setActionMeta(null); cargar(); } }}
        onSaved={cargar}
        onCompleted={celebrar}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  headerRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24, paddingTop: 8, paddingBottom: 24,
  },
  eyebrow: {
    fontSize: 11, letterSpacing: 1.1, textTransform: 'uppercase',
    fontWeight: '600', fontFamily: fonts.ui, marginBottom: 4,
  },
  heading: {
    fontFamily: fonts.display, fontStyle: 'italic', fontWeight: '400',
    fontSize: 30, lineHeight: 34, letterSpacing: -0.6,
  },
  btnNueva: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, minHeight: 44, borderRadius: br.full,
  },
  btnNuevaTxt: { fontSize: 14, fontWeight: '600', fontFamily: fonts.ui },
  tabs:        { flexDirection: 'row', gap: 8, paddingHorizontal: 24, marginBottom: 8 },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, minHeight: 44, borderRadius: br.full,
  },
  tabTxt:      { fontSize: 14, fontWeight: '600', fontFamily: fonts.ui },
  tabBadgeTxt: { fontSize: 13, fontWeight: '600', fontFamily: fonts.mono },
  list:        { paddingHorizontal: 24 },
  divider:     { height: StyleSheet.hairlineWidth },
  secTitulo:   { fontSize: 17, fontWeight: '600', fontFamily: fonts.ui, marginBottom: 4 },
  secTxt:      { fontSize: 14, lineHeight: 20, fontFamily: fonts.ui, marginBottom: 16 },
  secBtn:      { minHeight: 48, borderRadius: br.md, alignItems: 'center', justifyContent: 'center' },
  secBtnTxt:   { fontSize: 15, fontWeight: '600', fontFamily: fonts.ui },
});
