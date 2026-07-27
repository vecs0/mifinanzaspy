/**
 * (tabs)/crecer.tsx
 * Responsabilidad: Metas de ahorro (Crecé)
 * Usado por: expo-router (tab)
 * Depende de: metas, budgets
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, ActivityIndicator, Alert, Animated, Easing,
  TextInput, Keyboard,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import Svg, { Path, Circle, Rect, Line, Polyline, G } from 'react-native-svg';
import { useThemeCtx } from '@/services/ThemeContext';
import {
  getMetas, deleteMeta, getTotalAhorradoEnMetas, agregarAhorroAMeta, updateMeta,
  type Meta, type TipoMeta,
} from '@/services/metas';
import { getPresupuestosConGasto, type PresupuestoConGasto } from '@/services/budgets';
import { CATEGORIA_POR_ID } from '@/constants/categories';
import { colors, colorsDark, fonts, borderRadius as br } from '@/theme/design-system';

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

function Icon({ name, size = 20, color = '#181513', strokeWidth = 1.7 }: {
  name: IconName; size?: number; color?: string; strokeWidth?: number;
}) {
  const sw = { stroke: color, strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
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
    'trash':         <><Path {...sw} d="M3 6h18M19 6l-1 14H6L5 6M9 6V4h6v2" /></>,
    'shopping-cart': <><Circle cx="9" cy="21" r="1" fill={color} stroke="none" /><Circle cx="20" cy="21" r="1" fill={color} stroke="none" /><Path {...sw} d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" /></>,
    'pie':           <><Path {...sw} d="M12 3v9h9a9 9 0 11-9-9z" /><Path {...sw} d="M14 3a7 7 0 017 7h-7V3z" /></>,
    'bell':          <><Path {...sw} d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" /></>,
    'car':           <><Path {...sw} d="M5 17H3a2 2 0 01-2-2V9a2 2 0 012-2h16a2 2 0 012 2v6a2 2 0 01-2 2h-2M5 17h14M7 17v2M17 17v2" /><Path {...sw} d="M5 9l2-4h10l2 4" /></>,
    'cutlery':       <><Path {...sw} d="M3 3v6a3 3 0 006 0V3M6 3v18M21 15V2a5 5 0 00-5 5v6c0 1.1.9 2 2 2h3zm0 0v7" /></>,
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

interface GoalCardProps {
  meta: Meta;
  dark: boolean;
  t: typeof colors;
  accent: string;
  onPress: () => void;
  onDelete: (id: string) => void;
  onAvisosPress?: () => void;
}

function GoalCard({ meta, dark, t, accent, onPress, onDelete, onAvisosPress }: GoalCardProps) {
  const pct = meta.metaMonto > 0
    ? Math.min(100, Math.round((meta.actualMonto / meta.metaMonto) * 100))
    : 0;
  const vencida    = meta.diasRestantes <= 0;
  const amber      = '#d4902a';
  const isAmber    = pct >= 70;
  const colorPct   = isAmber ? amber : accent;
  const barColor   = isAmber ? amber : accent;
  const colorDias  = vencida ? t.negative : t.ink3;
  const labelDias  = vencida
    ? 'Vencida'
    : meta.diasRestantes == null
    ? 'Sin fecha límite'
    : `${meta.diasRestantes} días restantes`;
  const iconBoxBg = dark ? '#0d2218' : 'rgba(63,142,90,0.1)';

  const barAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(barAnim, {
      toValue: pct, duration: 600, delay: 100,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, []);

  const iconMap: Record<string, IconName> = {
    briefcase: 'briefcase', home: 'home', shield: 'shield',
    'credit-card': 'credit-card', sparkles: 'sparkles',
    'trend-up': 'trend-up', pie: 'pie',
  };
  const iconName = (iconMap[meta.icono] ?? 'sparkles') as IconName;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[gc.card, { backgroundColor: t.card, borderColor: t.hairline }]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        <View style={[gc.iconBox, { backgroundColor: iconBoxBg }]}>
          <Icon name={iconName} size={18} color={accent} strokeWidth={1.7} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Text style={[gc.titulo, { color: t.ink }]} numberOfLines={1}>{meta.titulo}</Text>
            <Text style={[gc.pct, { color: colorPct }]}>{pct}%</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
            <Icon name="calendar" size={11} color={colorDias} strokeWidth={1.7} />
            <Text style={[gc.dias, { color: colorDias }]}>{labelDias}</Text>
          </View>
          <View style={[gc.track, { backgroundColor: t.hairline }]}>
            <Animated.View style={[gc.fill, {
              width: barAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
              backgroundColor: barColor,
            }]} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
            <Text style={[gc.montoActual, { color: t.ink2 }]}>Gs {fmtGs(meta.actualMonto)}</Text>
            <Text style={[gc.montoMeta, { color: t.ink3 }]}>/ Gs {fmtGs(meta.metaMonto)}</Text>
          </View>
        </View>
      </View>

      <View style={[gc.footer, { borderTopColor: t.hairline }]}>
        {meta.esGrupo && (
          <View style={[gc.tagGrupo, { backgroundColor: dark ? 'rgba(63,142,90,0.12)' : 'rgba(63,142,90,0.1)' }]}>
            <Text style={[gc.tagGrupoTxt, { color: accent }]}>Grupo</Text>
          </View>
        )}
        {meta.esGrupo && meta.miembros.length > 0 && (
          <View style={{ flexDirection: 'row' }}>
            {meta.miembros.slice(0, 3).map((m, i) => (
              <View key={i} style={[gc.avatar, {
                marginLeft: i === 0 ? 0 : -6,
                backgroundColor: ['#B36A2A', '#3F8E5A', '#1F3A8A'][i % 3],
                borderColor: t.bg,
              }]}>
                <Text style={[gc.avatarTxt, { color: t.bg }]}>{m}</Text>
              </View>
            ))}
          </View>
        )}
        <TouchableOpacity
          style={{ marginLeft: 'auto' }}
          onPress={() => onAvisosPress?.()}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon
            name="bell"
            size={15}
            color={meta.notifCount > 0 ? amber : t.ink3}
            strokeWidth={1.6}
          />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const gc = StyleSheet.create({
  card:        { padding: 14, borderRadius: br.lg, borderWidth: 1 },
  iconBox:     { width: 36, height: 36, borderRadius: 9, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  titulo:      { fontSize: 14, fontWeight: '600', flex: 1, fontFamily: fonts.ui },
  pct:         { fontSize: 14, fontWeight: '700', fontFamily: fonts.mono },
  dias:        { fontSize: 11, fontFamily: fonts.ui },
  track:       { height: 5, borderRadius: 3, marginTop: 8, overflow: 'hidden' },
  fill:        { height: '100%', borderRadius: 3 },
  montoActual: { fontFamily: fonts.mono, fontSize: 11 },
  montoMeta:   { fontFamily: fonts.mono, fontSize: 11 },
  footer:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingTop: 10, borderTopWidth: 1 },
  tagGrupo:    { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  tagGrupoTxt: { fontSize: 10.5, fontWeight: '600', fontFamily: fonts.ui },
  tagNotif:    { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  tagNotifTxt: { fontSize: 10.5, fontWeight: '600', fontFamily: fonts.ui },
  avatar:      { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  avatarTxt:   { fontSize: 9, fontWeight: '700', fontFamily: fonts.ui },
});

const TIPOS: { id: TipoMeta; titulo: string; desc: string; icon: IconName }[] = [
  { id: 'solo',  titulo: 'Solo',        desc: 'Solo para vos.',           icon: 'home' },
  { id: 'grupo', titulo: 'Grupo',       desc: 'Compartida con otros.',    icon: 'briefcase' },
  { id: 'fijo',  titulo: 'Fijo',        desc: 'Monto exacto, con fecha.', icon: 'lock' },
  { id: 'largo', titulo: 'Largo plazo', desc: 'Más de 1 año.',            icon: 'trend-up' },
];

function MetaTipoModal({ visible, onClose, accent, t, initialTipo }: {
  visible: boolean; onClose: () => void; accent: string; t: typeof colors; initialTipo?: TipoMeta;
}) {
  const insets = useSafeAreaInsets();
  const [sel, setSel] = useState<TipoMeta>(initialTipo ?? 'solo');
  const router = useRouter();

  useEffect(() => { if (visible) setSel(initialTipo ?? 'solo'); }, [visible, initialTipo]);

  function continuar() {
    onClose();
    router.push({ pathname: '/meta/nueva', params: { tipo: sel } } as any);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}
        activeOpacity={1}
        onPress={onClose}
      />
      <View style={[mt.sheet, { backgroundColor: t.bg, paddingBottom: insets.bottom + 16 }]}>
        <View style={[mt.pill, { backgroundColor: t.ink3 }]} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <View>
            <Text style={[mt.eyebrow, { color: t.ink3 }]}>Nueva meta</Text>
            <Text style={[mt.heading, { color: t.ink }]}>¿Qué tipo?</Text>
            <Text style={[mt.sub, { color: t.ink3 }]}>Elegí cómo querés ahorrar.</Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Icon name="x" size={20} color={t.ink2} />
          </TouchableOpacity>
        </View>
        <View style={mt.grid}>
          {TIPOS.map(tp => {
            const on = sel === tp.id;
            return (
              <TouchableOpacity
                key={tp.id}
                style={[mt.card, { backgroundColor: t.card, borderColor: on ? accent : t.hairline },
                  on && { backgroundColor: 'rgba(63,142,90,0.07)' }]}
                onPress={() => setSel(tp.id)}
                activeOpacity={0.75}
              >
                <View style={[mt.iconBox, { backgroundColor: on ? accent : t.surface }]}>
                  <Icon name={tp.icon} size={17} color={on ? colorsDark.bg : t.ink2} strokeWidth={1.7} />
                </View>
                <View style={{ flex: 1, justifyContent: 'flex-end' }}>
                  <Text style={[mt.cardTitulo, { color: t.ink }]}>{tp.titulo}</Text>
                  <Text style={[mt.cardDesc, { color: t.ink3 }]}>{tp.desc}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
        <TouchableOpacity style={[mt.btn, { backgroundColor: accent }]} onPress={continuar} activeOpacity={0.85}>
          <Text style={[mt.btnTxt, { color: colorsDark.bg }]}>Continuar</Text>
          <Icon name="arrow-right" size={16} color={colorsDark.bg} strokeWidth={2} />
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const mt = StyleSheet.create({
  sheet:      { borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 22, paddingTop: 12 },
  pill:       { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  eyebrow:    { fontSize: 10.5, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: '600', fontFamily: fonts.ui },
  heading:    { fontFamily: fonts.display, fontStyle: 'italic', fontSize: 22, lineHeight: 24, marginTop: 4, marginBottom: 2, fontWeight: '400' },
  sub:        { fontSize: 12, lineHeight: 18, fontFamily: fonts.ui },
  grid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  card:       { width: '47.5%', minHeight: 110, padding: 16, borderRadius: br.lg, borderWidth: 1, flexDirection: 'column', gap: 10 },
  iconBox:    { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardTitulo: { fontSize: 14, fontWeight: '600', fontFamily: fonts.ui },
  cardDesc:   { fontSize: 12, marginTop: 2, fontFamily: fonts.ui },
  btn:        { height: 50, borderRadius: br.lg, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  btnTxt:     { fontSize: 15, fontWeight: '600', fontFamily: fonts.ui },
});

const AVISO_TIPOS = [
  { ico: 'bell' as IconName,      titulo: 'Sin actividad por 7 días',    desc: 'Te recordamos agregar ahorro si no hubo movimiento reciente.' },
  { ico: 'calendar' as IconName,  titulo: 'A 7 días del vencimiento',    desc: 'Alerta antes de que se cumpla la fecha límite de la meta.' },
  { ico: 'trend-up' as IconName,  titulo: 'Hito alcanzado (50% / 80%)',  desc: 'Notificación cuando llegás a un porcentaje clave del objetivo.' },
  { ico: 'check' as IconName,     titulo: 'Meta completada',             desc: 'Celebración cuando alcanzás el 100% de tu objetivo.' },
];

function AvisoSheet({ meta, visible, onClose, onRead, t, dark }: {
  meta: Meta | null; visible: boolean; onClose: () => void; onRead: () => void;
  t: typeof colors; dark: boolean;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const amber  = '#d4902a';
  const amberBg    = dark ? '#2a1208' : 'rgba(201,124,46,0.07)';
  const amberBorder = dark ? '#3a2208' : 'rgba(201,124,46,0.18)';

  if (!meta) return null;

  const n         = Math.min(meta.notifCount, AVISO_TIPOS.length);
  const mostrar   = AVISO_TIPOS.slice(0, Math.max(n, 1));
  const esSistema = meta.notifCount > 0;

  function handleClose() {
    if (esSistema) onRead();
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }}
        activeOpacity={1} onPress={handleClose} />
      <View style={[avs.sheet, { backgroundColor: t.bg, paddingBottom: insets.bottom + 20 }]}>
        <View style={[avs.pill, { backgroundColor: t.hairline }]} />

        <View style={avs.hdrRow}>
          <View style={[avs.hdrIco, { backgroundColor: amberBg, borderColor: amberBorder }]}>
            <Icon name="bell" size={18} color={amber} strokeWidth={1.6} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[avs.eyebrow, { color: t.ink3 }]}>Avisos de meta</Text>
            <Text style={[avs.titulo, { color: t.ink }]} numberOfLines={1}>{meta.titulo}</Text>
          </View>
          <TouchableOpacity onPress={handleClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Icon name="x" size={18} color={t.ink3} strokeWidth={1.7} />
          </TouchableOpacity>
        </View>

        <View style={[avs.countBox, { backgroundColor: amberBg, borderColor: amberBorder }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={[avs.countNum, { color: amber }]}>{meta.notifCount}</Text>
            <View>
              <Text style={[avs.countLbl, { color: amber }]}>
                aviso{meta.notifCount !== 1 ? 's' : ''} activo{meta.notifCount !== 1 ? 's' : ''}
              </Text>
              <Text style={[avs.countSub, { color: amber, opacity: 0.6 }]}>
                {esSistema ? 'configurados por el sistema' : 'ninguno activo aún'}
              </Text>
            </View>
          </View>
        </View>

        <Text style={[avs.secLabel, { color: t.ink3 }]}>Tipos de aviso</Text>
        <View style={[avs.listBox, { borderColor: t.hairline }]}>
          {mostrar.map((a, i) => (
            <View key={i} style={[avs.avisoRow,
              i < mostrar.length - 1 && { borderBottomWidth: 1, borderBottomColor: t.hairline }
            ]}>
              <View style={[avs.avIco, { backgroundColor: i < n ? amberBg : t.surface }]}>
                <Icon name={a.ico} size={13} color={i < n ? amber : t.ink3} strokeWidth={1.6} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[avs.avTitulo, { color: i < n ? t.ink : t.ink3 }]}>{a.titulo}</Text>
                <Text style={[avs.avDesc, { color: t.ink3 }]} numberOfLines={2}>{a.desc}</Text>
              </View>
              {i < n && (
                <View style={[avs.dot, { backgroundColor: amber }]} />
              )}
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[avs.btnLink, { backgroundColor: t.card, borderColor: t.hairline }]}
          onPress={() => { handleClose(); setTimeout(() => router.push('/recordatorios' as any), 300); }}
          activeOpacity={0.75}
        >
          <View style={[avs.btnLinkIco, { backgroundColor: t.surface }]}>
            <Icon name="bell" size={14} color={t.ink2} strokeWidth={1.6} />
          </View>
          <Text style={[avs.btnLinkTxt, { color: t.ink }]}>Gestionar recordatorios</Text>
          <Icon name="arrow-right" size={14} color={t.ink3} strokeWidth={1.7} />
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const avs = StyleSheet.create({
  sheet:     { borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 20, paddingTop: 10 },
  pill:      { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
  hdrRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  hdrIco:    { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  eyebrow:   { fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', fontWeight: '600', fontFamily: fonts.ui },
  titulo:    { fontSize: 15, fontWeight: '600', fontFamily: fonts.ui, marginTop: 1 },
  countBox:  { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 16 },
  countNum:  { fontFamily: fonts.mono, fontSize: 32, fontWeight: '700', letterSpacing: -1 },
  countLbl:  { fontSize: 13, fontWeight: '600', fontFamily: fonts.ui },
  countSub:  { fontSize: 11, fontFamily: fonts.ui, marginTop: 1 },
  secLabel:  { fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: '600', fontFamily: fonts.ui, marginBottom: 8 },
  listBox:   { borderRadius: 14, borderWidth: 1, overflow: 'hidden', marginBottom: 14 },
  avisoRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  avIco:     { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avTitulo:  { fontSize: 12, fontWeight: '600', fontFamily: fonts.ui },
  avDesc:    { fontSize: 11, fontFamily: fonts.ui, marginTop: 1, lineHeight: 15 },
  dot:       { width: 6, height: 6, borderRadius: 3, flexShrink: 0 },
  btnLink:   { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13, borderRadius: 14, borderWidth: 1 },
  btnLinkIco: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  btnLinkTxt: { flex: 1, fontSize: 14, fontWeight: '500', fontFamily: fonts.ui },
});

function GoalActionSheet({ meta, visible, onClose, t, dark, accent, onEdit, onDelete, onSaved }: {
  meta: Meta | null; visible: boolean; onClose: () => void;
  t: typeof colors; dark: boolean; accent: string;
  onEdit: () => void; onDelete: () => void; onSaved: () => void;
}) {
  const insets   = useSafeAreaInsets();
  const [str, setStr] = useState('');
  const num = parseGs(str);

  useEffect(() => { if (!visible) setStr(''); }, [visible]);

  if (!meta) return null;

  const pct      = meta.metaMonto > 0 ? Math.min(100, Math.round((meta.actualMonto / meta.metaMonto) * 100)) : 0;
  const amber    = '#d4902a';
  const barColor = pct >= 70 ? amber : accent;
  const pctColor = pct >= 70 ? amber : accent;
  const iconBg   = dark ? '#0d2218' : 'rgba(63,142,90,0.1)';
  const hdrBg    = dark ? '#0d2218' : 'rgba(63,142,90,0.05)';
  const hdrBorder = dark ? '#1a3a28' : 'rgba(63,142,90,0.15)';
  const iconMap: Record<string, IconName> = {
    briefcase: 'briefcase', home: 'home', shield: 'shield',
    'credit-card': 'credit-card', sparkles: 'sparkles',
    'trend-up': 'trend-up', pie: 'pie',
  };
  const iconName = (iconMap[meta.icono] ?? 'sparkles') as IconName;

  function guardar() {
    if (num <= 0) return;
    if (!meta) return;
    agregarAhorroAMeta(meta.id, num);
    Keyboard.dismiss();
    onSaved();
    onClose();
  }

  function confirmarEliminar() {
    if (!meta) return;
    onClose();
    setTimeout(() => {
      Alert.alert('Eliminar meta', `¿Eliminar "${meta.titulo}"?`, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: onDelete },
      ]);
    }, 300);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => { Keyboard.dismiss(); onClose(); }}>
      <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }}
        activeOpacity={1} onPress={() => { Keyboard.dismiss(); onClose(); }} />
      <View style={[gas.sheet, { backgroundColor: t.bg, paddingBottom: insets.bottom + 20 }]}>
        <View style={[gas.pill, { backgroundColor: t.hairline }]} />

        <View style={[gas.hdr, { backgroundColor: hdrBg, borderColor: hdrBorder }]}>
          <View style={[gas.iconBox, { backgroundColor: iconBg }]}>
            <Icon name={iconName} size={18} color={accent} strokeWidth={1.7} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[gas.titulo, { color: t.ink }]} numberOfLines={1}>{meta.titulo}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
              <Text style={[gas.montoActual, { color: t.ink2 }]}>Gs {fmtGs(meta.actualMonto)}</Text>
              <Text style={{ color: t.ink3, fontSize: 10 }}>·</Text>
              <Text style={[gas.montoMeta, { color: t.ink3 }]}>/ Gs {fmtGs(meta.metaMonto)}</Text>
            </View>
          </View>
          <Text style={[gas.pct, { color: pctColor }]}>{pct}%</Text>
        </View>

        <View style={[gas.track, { backgroundColor: t.hairline }]}>
          <View style={[gas.fill, { width: `${pct}%` as any, backgroundColor: barColor }]} />
        </View>

        <Text style={[gas.label, { color: t.ink3 }]}>Agregar ahorro</Text>
        <View style={[gas.inputRow, { backgroundColor: t.card, borderColor: t.hairline }]}>
          <Text style={[gas.inputPfx, { color: t.ink2 }]}>Gs</Text>
          <TextInput
            style={[gas.input, { color: t.ink }]}
            value={str}
            onChangeText={v => setStr(formatGs(parseGs(v)))}
            placeholder="0"
            placeholderTextColor={t.ink3}
            keyboardType="number-pad"
          />
        </View>

        <TouchableOpacity
          style={[gas.btnP, { backgroundColor: accent, opacity: num > 0 ? 1 : 0.35 }]}
          onPress={guardar} disabled={num <= 0} activeOpacity={0.85}
        >
          <Text style={[gas.btnPTxt, { color: colorsDark.bg }]}>Guardar ahorro</Text>
        </TouchableOpacity>

        <View style={[gas.sep, { backgroundColor: t.hairline }]} />

        <TouchableOpacity style={gas.btnS} onPress={() => { onClose(); setTimeout(onEdit, 300); }} activeOpacity={0.7}>
          <View style={[gas.btnSIco, { backgroundColor: t.surface }]}>
            <Icon name="sparkles" size={14} color={t.ink2} strokeWidth={1.6} />
          </View>
          <Text style={[gas.btnSTxt, { color: t.ink }]}>Editar meta</Text>
          <Icon name="arrow-right" size={14} color={t.ink3} strokeWidth={1.7} />
        </TouchableOpacity>

        <TouchableOpacity style={gas.btnD} onPress={confirmarEliminar} activeOpacity={0.7}>
          <View style={[gas.btnSIco, { backgroundColor: dark ? 'rgba(168,64,31,0.15)' : 'rgba(168,64,31,0.08)' }]}>
            <Icon name="trash" size={14} color={t.negative} strokeWidth={1.6} />
          </View>
          <Text style={[gas.btnDTxt, { color: t.negative }]}>Eliminar esta meta</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const gas = StyleSheet.create({
  sheet:    { borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 20, paddingTop: 10 },
  pill:     { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
  hdr:      { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, borderWidth: 1, marginBottom: 10 },
  iconBox:  { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  titulo:   { fontSize: 14, fontWeight: '600', fontFamily: fonts.ui },
  montoActual: { fontSize: 12, fontFamily: fonts.mono },
  montoMeta:   { fontSize: 12, fontFamily: fonts.mono },
  pct:      { fontSize: 16, fontWeight: '700', fontFamily: fonts.mono },
  track:    { height: 5, borderRadius: 3, overflow: 'hidden', marginBottom: 16 },
  fill:     { height: '100%', borderRadius: 3 },
  label:    { fontSize: 10.5, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: '600', fontFamily: fonts.ui, marginBottom: 8 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, height: 48, marginBottom: 12 },
  inputPfx: { fontFamily: fonts.display, fontStyle: 'italic', fontSize: 17 },
  input:    { flex: 1, fontSize: 18, fontFamily: fonts.mono, paddingVertical: 0 },
  btnP:     { height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  btnPTxt:  { fontSize: 15, fontWeight: '600', fontFamily: fonts.ui },
  sep:      { height: 1, marginVertical: 14 },
  btnS:     { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  btnSIco:  { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  btnSTxt:  { flex: 1, fontSize: 14, fontWeight: '500', fontFamily: fonts.ui },
  btnD:     { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  btnDTxt:  { flex: 1, fontSize: 14, fontWeight: '500', fontFamily: fonts.ui },
});



function SummaryCard({ total, metas, dark, accent, pctTotal }: {
  total: number; metas: number; dark: boolean; accent: string; pctTotal: number;
}) {
  const bg     = dark ? '#0d2218' : 'rgba(63,142,90,0.07)';
  const border = dark ? '#1a3a28' : 'rgba(63,142,90,0.2)';
  const ringBg = dark ? '#1a3a28' : 'rgba(63,142,90,0.15)';
  const R      = 24;
  const circ   = 2 * Math.PI * R;
  const filled = (pctTotal / 100) * circ;
  const mesLabel = new Date().toLocaleDateString('es-PY', { month: 'long', year: 'numeric' });

  return (
    <View style={[sc.wrap, { backgroundColor: bg, borderColor: border }]}>
      <View style={sc.row}>
        <View style={{ flex: 1 }}>
          <Text style={[sc.eyebrow, { color: accent }]}>Ahorrado en metas</Text>
          <Text style={[sc.monto, { color: accent }]}>Gs {fmtGsFull(total)}</Text>
          <Text style={[sc.sub, { color: accent, opacity: 0.65 }]}>
            {metas} meta{metas !== 1 ? 's' : ''} activa{metas !== 1 ? 's' : ''} · {mesLabel}
          </Text>
        </View>
        <View style={sc.ringWrap}>
          <Svg width={60} height={60} viewBox="0 0 60 60">
            <G rotation="-90" origin="30, 30">
              <Circle cx="30" cy="30" r={R} fill="none" stroke={ringBg} strokeWidth={6} />
              <Circle
                cx="30" cy="30" r={R} fill="none"
                stroke={accent} strokeWidth={6}
                strokeDasharray={[filled, circ]}
                strokeLinecap="round"
              />
            </G>
          </Svg>
          <View style={sc.ringLabel}>
            <Text style={[sc.ringPct, { color: accent }]}>{pctTotal}%</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const sc = StyleSheet.create({
  wrap:      { marginHorizontal: 22, marginBottom: 14, padding: 16, borderRadius: 16, borderWidth: 1 },
  row:       { flexDirection: 'row', alignItems: 'center', gap: 12 },
  eyebrow:   { fontSize: 10.5, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: '600', fontFamily: fonts.ui, marginBottom: 6 },
  monto:     { fontFamily: fonts.mono, fontSize: 26, fontWeight: '700', letterSpacing: -0.5, marginBottom: 3 },
  sub:       { fontSize: 11, fontFamily: fonts.ui },
  ringWrap:  { position: 'relative', width: 60, height: 60, flexShrink: 0 },
  ringLabel: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  ringPct:   { fontSize: 12, fontWeight: '700', fontFamily: fonts.mono },
});

function PresupuestosGrid({ presupuestos, t, dark, accent }: {
  presupuestos: PresupuestoConGasto[];
  t: typeof colors;
  dark: boolean;
  accent: string;
}) {
  const router   = useRouter();
  const items    = presupuestos.slice(0, 4);
  const mesLabel = new Date().toLocaleDateString('es-PY', { month: 'long' });

  return (
    <View style={pg.wrap}>
      <View style={pg.hdr}>
        <View>
          <Text style={[pg.eyebrow, { color: t.ink3 }]}>Control de gasto</Text>
          <Text style={[pg.title, { color: t.ink }]}>Presupuestos · {mesLabel}</Text>
        </View>
        <TouchableOpacity
          style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}
          onPress={() => router.push('/presupuestos' as any)}
          activeOpacity={0.7}
        >
          <Text style={[pg.link, { color: accent }]}>Ver todo</Text>
          <Icon name="arrow-right" size={12} color={accent} strokeWidth={2} />
        </TouchableOpacity>
      </View>
      <View style={pg.grid}>
        {items.map(p => {
          const cat      = CATEGORIA_POR_ID[p.categoriaId];
          const tinte    = cat?.tinte ?? '#888';
          const over     = p.pct >= 100;
          const iconBg   = `${tinte}${dark ? '22' : '18'}`;
          const pctClr   = over ? t.negative : tinte;
          const restante = p.montoLimite - p.gastado;
          return (
            <View key={p.id} style={[pg.card, { backgroundColor: t.card, borderColor: t.hairline }]}>
              <View style={pg.cardTop}>
                <View style={[pg.catIco, { backgroundColor: iconBg }]}>
                  <Icon name={catIcon(cat?.icono ?? '')} size={13} color={tinte} strokeWidth={1.8} />
                </View>
                <Text style={[pg.pct, { color: pctClr }]}>{p.pct}%</Text>
              </View>
              <Text style={[pg.catName, { color: t.ink }]} numberOfLines={1}>{cat?.nombre ?? p.categoriaId}</Text>
              <View style={[pg.bar, { backgroundColor: t.hairline }]}>
                <View style={[pg.barFill, {
                  width: `${Math.min(100, p.pct)}%` as any,
                  backgroundColor: over ? t.negative : tinte,
                }]} />
              </View>
              <View style={pg.cardRow}>
                <Text style={[pg.usado, { color: over ? t.negative : t.ink3 }]}>
                  Gs {fmtGs(p.gastado)}
                </Text>
                <Text style={[pg.rest, { color: over ? t.negative : t.ink3 }]}>
                  {over ? `−Gs ${fmtGs(Math.abs(restante))}` : `Gs ${fmtGs(restante)}`}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const pg = StyleSheet.create({
  wrap:    { paddingHorizontal: 22 },
  hdr:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 },
  eyebrow: { fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase', fontWeight: '600', fontFamily: fonts.ui, marginBottom: 2 },
  title:   { fontSize: 14, fontWeight: '600', fontFamily: fonts.ui },
  link:    { fontSize: 11, fontFamily: fonts.ui, fontWeight: '500' },
  grid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  card:    { width: '48.5%', padding: 10, borderRadius: 12, borderWidth: 1 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  catIco:  { width: 26, height: 26, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  pct:     { fontSize: 10, fontWeight: '600', fontFamily: fonts.mono },
  catName: { fontSize: 12, fontWeight: '500', fontFamily: fonts.ui, marginBottom: 5 },
  bar:     { height: 4, borderRadius: 2, overflow: 'hidden', marginBottom: 5 },
  barFill: { height: '100%', borderRadius: 2 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between' },
  usado:   { fontSize: 10, fontFamily: fonts.mono },
  rest:    { fontSize: 10, fontFamily: fonts.mono },
});

export default function CrecerScreen() {
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;
  const accent = '#3F8E5A';
  const router  = useRouter();
  const insets  = useSafeAreaInsets();

  const [metas, setMetas]               = useState<Meta[]>([]);
  const [presupuestos, setPresupuestos] = useState<PresupuestoConGasto[]>([]);
  const [cargando, setCargando]         = useState(true);
  const [tab, setTab]                   = useState<'mias' | 'grupo'>('mias');
  const [showModal, setShowModal]       = useState(false);
  const [modalTipo, setModalTipo]       = useState<TipoMeta | undefined>(undefined);
  const [totalAhorro, setTotalAhorro]   = useState(0);
  const [actionMeta, setActionMeta]     = useState<Meta | null>(null);
  const [avisoMeta, setAvisoMeta]       = useState<Meta | null>(null);

  const cargar = useCallback(() => {
    const mesKey = new Date().toISOString().slice(0, 7);
    setCargando(true);
    try {
      const data = getMetas();
      setMetas(data);
      setTotalAhorro(getTotalAhorradoEnMetas());
      setPresupuestos(getPresupuestosConGasto(mesKey));
    } catch {
      Alert.alert('Error', 'No se pudieron cargar las metas.');
    } finally {
      setCargando(false);
    }
  }, []);

  useFocusEffect(cargar);

  const metasFiltradas = metas.filter(m => tab === 'mias' ? !m.esGrupo : m.esGrupo);
  const totalTarget    = metas.reduce((sum, m) => sum + m.metaMonto, 0);
  const pctTotal       = totalTarget > 0 ? Math.min(100, Math.round((totalAhorro / totalTarget) * 100)) : 0;
  const tabActiveBg    = dark ? '#1c2a1c' : 'rgba(63,142,90,0.1)';
  const tabActiveBorder = dark ? '#2d3d2d' : 'rgba(63,142,90,0.2)';

  function abrirNueva(tipo?: TipoMeta) {
    setModalTipo(tipo);
    setShowModal(true);
  }

  function onCardPress(m: Meta) {
    setActionMeta(m);
  }

  if (cargando) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
        <ActivityIndicator color={accent} style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
      >
        <View style={s.headerRow}>
          <View>
            <Text style={[s.eyebrow, { color: t.ink3 }]}>Crecé</Text>
            <Text style={[s.heading, { color: t.ink }]}>Tus metas</Text>
          </View>
          <TouchableOpacity
            style={[s.btnNueva, { backgroundColor: tabActiveBg, borderColor: tabActiveBorder }]}
            onPress={() => abrirNueva()}
            activeOpacity={0.8}
          >
            <Icon name="plus" size={13} color={accent} strokeWidth={2} />
            <Text style={[s.btnNuevaTxt, { color: accent }]}>Nueva</Text>
          </TouchableOpacity>
        </View>

        {metas.length > 0 && (
          <FadeSlideIn delay={50}>
            <SummaryCard
              total={totalAhorro}
              metas={metas.length}
              dark={dark}
              accent={accent}
              pctTotal={pctTotal}
            />
          </FadeSlideIn>
        )}

        {metas.length > 0 && (
          <FadeSlideIn delay={100}>
            <View style={s.tabs}>
              {([
                ['mias',  'Mis metas',   metas.filter(m => !m.esGrupo).length],
                ['grupo', 'Compartidas', metas.filter(m =>  m.esGrupo).length],
              ] as [typeof tab, string, number][]).map(([k, l, n]) => (
                <TouchableOpacity
                  key={k}
                  style={[s.tab,
                    tab === k
                      ? { backgroundColor: tabActiveBg, borderColor: tabActiveBorder }
                      : { borderColor: 'transparent' },
                  ]}
                  onPress={() => setTab(k)}
                  activeOpacity={0.75}
                >
                  <Text style={[s.tabTxt, { color: tab === k ? accent : t.ink2 }]}>{l}</Text>
                  <View style={[s.tabBadge, {
                    backgroundColor: tab === k
                      ? dark ? 'rgba(63,142,90,0.15)' : 'rgba(63,142,90,0.12)'
                      : t.surface,
                  }]}>
                    <Text style={[s.tabBadgeTxt, { color: tab === k ? accent : t.ink3 }]}>{n}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </FadeSlideIn>
        )}

        <View style={s.list}>
          {metas.length === 0 ? (
            <View style={[s.emptyBox, { borderColor: t.hairline }]}>
              <Icon name="sparkles" size={28} color={accent} strokeWidth={1.5} />
              <Text style={[s.emptyTitle, { color: t.ink }]}>Empezá a crecer</Text>
              <Text style={[s.emptyTxt, { color: t.ink3 }]}>
                Creá una meta de ahorro para alcanzar tus objetivos.
              </Text>
              <TouchableOpacity
                style={[s.emptyBtn, { backgroundColor: accent }]}
                onPress={() => abrirNueva()}
                activeOpacity={0.8}
              >
                <Icon name="plus" size={14} color={colorsDark.bg} strokeWidth={2} />
                <Text style={[s.emptyBtnTxt, { color: colorsDark.bg }]}>Nueva meta</Text>
              </TouchableOpacity>
            </View>
          ) : (
            metasFiltradas.map((m, i) => {
              const pct = m.metaMonto > 0
                ? Math.min(100, Math.round((m.actualMonto / m.metaMonto) * 100))
                : 0;
              return (
                <FadeSlideIn key={m.id} delay={150 + i * 80}>
                  <GoalCard
                    meta={m}
                    dark={dark}
                    t={t}
                    accent={accent}
                    onPress={() => onCardPress(m)}
                    onAvisosPress={() => setAvisoMeta(m)}
                    onDelete={id => {
                      Alert.alert('Eliminar meta', `¿Eliminar "${m.titulo}"?`, [
                        { text: 'Cancelar', style: 'cancel' },
                        { text: 'Eliminar', style: 'destructive', onPress: () => { deleteMeta(id); cargar(); } },
                      ]);
                    }}
                  />
                </FadeSlideIn>
              );
            })
          )}
        </View>

        {presupuestos.length > 0 ? (
          <FadeSlideIn delay={200 + metasFiltradas.length * 80}>
            <View style={{ marginTop: 20 }}>
              <PresupuestosGrid presupuestos={presupuestos} t={t} dark={dark} accent={accent} />
            </View>
          </FadeSlideIn>
        ) : (
          <FadeSlideIn delay={200 + metasFiltradas.length * 80}>
            <TouchableOpacity
              style={[s.presupCard, { backgroundColor: t.card, borderColor: t.hairline }]}
              onPress={() => router.push('/presupuestos' as any)}
              activeOpacity={0.8}
            >
              <View style={{ flex: 1 }}>
                <Text style={[s.presupEyebrow, { color: t.ink3 }]}>Control de gasto</Text>
                <Text style={[s.presupTitle, { color: t.ink }]}>
                  Presupuestos · {new Date().toLocaleDateString('es-PY', { month: 'long' })}
                </Text>
              </View>
              <Icon name="arrow-right" size={16} color={t.ink3} strokeWidth={1.7} />
            </TouchableOpacity>
          </FadeSlideIn>
        )}
      </ScrollView>

      <MetaTipoModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        accent={accent}
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
        dark={dark}
      />

      <GoalActionSheet
        meta={actionMeta}
        visible={actionMeta !== null}
        onClose={() => setActionMeta(null)}
        t={t}
        dark={dark}
        accent={accent}
        onEdit={() => router.push({ pathname: '/meta/nueva', params: { id: actionMeta?.id } } as any)}
        onDelete={() => { if (actionMeta) { deleteMeta(actionMeta.id); setActionMeta(null); cargar(); } }}
        onSaved={cargar}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  headerRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: 22, paddingTop: 8, paddingBottom: 14,
  },
  eyebrow: {
    fontSize: 10.5, letterSpacing: 1.2, textTransform: 'uppercase',
    fontWeight: '600', fontFamily: fonts.ui, marginBottom: 2,
  },
  heading: {
    fontFamily: fonts.display, fontStyle: 'italic', fontWeight: '400',
    fontSize: 28, lineHeight: 30, letterSpacing: -0.5,
  },
  btnNueva: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 13, paddingVertical: 7, borderRadius: 999, borderWidth: 0.5,
    marginTop: 14,
  },
  btnNuevaTxt: { fontSize: 12, fontWeight: '500', fontFamily: fonts.ui },
  tabs:        { flexDirection: 'row', gap: 6, paddingHorizontal: 22, marginBottom: 14 },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 0.5,
  },
  tabTxt:      { fontSize: 12, fontWeight: '500', fontFamily: fonts.ui },
  tabBadge:    { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999 },
  tabBadgeTxt: { fontSize: 11, fontWeight: '600', fontFamily: fonts.ui },
  list:        { paddingHorizontal: 22, gap: 12, flexDirection: 'column' },
  emptyBox: {
    padding: 32, borderRadius: br.lg, borderWidth: 1, borderStyle: 'dashed',
    alignItems: 'center', gap: 12,
  },
  emptyTitle: { fontSize: 16, fontWeight: '600', fontFamily: fonts.ui },
  emptyTxt: { fontSize: 13, lineHeight: 20, textAlign: 'center', fontFamily: fonts.ui },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999, marginTop: 4,
  },
  emptyBtnTxt: { fontSize: 13, fontWeight: '600', fontFamily: fonts.ui },
  presupCard: {
    flexDirection: 'row', alignItems: 'center', padding: 16,
    borderRadius: br.lg, borderWidth: 1, marginHorizontal: 22, marginTop: 20,
  },
  presupEyebrow: { fontSize: 10.5, letterSpacing: 1, textTransform: 'uppercase', fontWeight: '600', fontFamily: fonts.ui, marginBottom: 3 },
  presupTitle:   { fontSize: 14, fontWeight: '600', fontFamily: fonts.ui },
});
