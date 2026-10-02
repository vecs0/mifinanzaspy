/**
 * onboarding/objetivos.tsx
 * Responsabilidad: Paso 3 de onboarding — Elegir objetivos financieros
 * Usado por: expo-router (onboarding flow)
 * Depende de: database
 */
import { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert,
} from 'react-native';
import { useThemeCtx } from '@/services/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Path, Polyline, Rect, Circle, Line } from 'react-native-svg';
import { setConfig } from '@/services/database';
import { colors, colorsDark, fonts, borderRadius as br, iconStroke, hit } from '@/theme/design-system';


type IconName = 'cutlery' | 'pie' | 'trend-up' | 'credit-card' | 'shopping-cart' | 'shield';

function ObjIcon({ name, size = 18, color }: { name: IconName; size?: number; color: string }) {
  const sw = { stroke: color, strokeWidth: iconStroke, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  const icons: Record<IconName, React.ReactNode> = {
    'cutlery': <>
      <Path {...sw} d="M3 3v6a3 3 0 006 0V3" stroke={color} />
      <Path {...sw} d="M6 3v18" stroke={color} />
      <Path {...sw} d="M21 3l-1 9h-4l-1-9" stroke={color} />
      <Path {...sw} d="M19 12v10" stroke={color} />
    </>,
    'pie': <>
      <Path {...sw} d="M12 3v9h9a9 9 0 11-9-9z" />
      <Path {...sw} d="M14 3a7 7 0 017 7h-7V3z" />
    </>,
    'trend-up': <>
      <Polyline {...sw} points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <Polyline {...sw} points="17 6 23 6 23 12" />
    </>,
    'credit-card': <>
      <Rect x="1" y="4" width="22" height="16" rx="2" {...sw} />
      <Line x1="1" y1="10" x2="23" y2="10" {...sw} />
    </>,
    'shopping-cart': <>
      <Circle cx="9" cy="21" r="1" fill={color} stroke="none" />
      <Circle cx="20" cy="21" r="1" fill={color} stroke="none" />
      <Path {...sw} d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" />
    </>,
    'shield': <Path {...sw} d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {icons[name]}
    </Svg>
  );
}

function CheckIcon({ color }: { color: string }) {
  return (
    <Svg width={11} height={11} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M20 6L9 17l-5-5" />
    </Svg>
  );
}

function ArrowLeftIcon() {
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"
      stroke={t.ink} strokeWidth={iconStroke} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 12H5M12 19l-7-7 7-7" />
    </Svg>
  );
}

interface Opcion {
  id: string;
  titulo: string;
  icon: IconName;
  hint: string;
}

const OPCIONES: Opcion[] = [
  { id: 'frenar_delivery',  titulo: 'Frenar el delivery',  icon: 'cutlery',       hint: 'Bolsi, Lido, PedidosYa' },
  { id: 'controlar_gasto',  titulo: 'Controlar gastos',    icon: 'pie',           hint: 'saber adónde se va' },
  { id: 'crecer_ahorro',    titulo: 'Crecer mi ahorro',    icon: 'trend-up',      hint: 'mes a mes' },
  { id: 'bajar_deuda',      titulo: 'Bajar la tarjeta',    icon: 'credit-card',   hint: 'sin intereses' },
  { id: 'comprar_algo',     titulo: 'Comprar algo grande', icon: 'shopping-cart', hint: 'auto, viaje, hogar' },
  { id: 'fondo_emerg',      titulo: 'Fondo de urgencia',   icon: 'shield',        hint: '3 meses de gasto' },
];

const MIN_SEL = 3;

export default function ObjetivosScreen() {
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;
  const s = useStyles(t);
  const router = useRouter();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [guardando, setGuardando] = useState(false);

  const toggle = (id: string) => {
    const n = new Set(sel);
    n.has(id) ? n.delete(id) : n.add(id);
    setSel(n);
  };

  const puedeAvanzar = sel.size >= MIN_SEL;

  async function continuar() {
    if (!puedeAvanzar || guardando) return;
    setGuardando(true);
    try {
      setConfig('onboarding_objetivos', JSON.stringify([...sel]));
      router.push('/onboarding/bancos' as any);
    } catch (e) {
      Alert.alert('Error', 'No se pudieron guardar tus objetivos.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}
          hitSlop={hit}
          style={s.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Volver">
          <ArrowLeftIcon />
        </TouchableOpacity>
        <Text style={s.pasoNum}>3 / 5</Text>
      </View>

      <View style={s.titulo}>
        <Text style={s.eyebrow}>03 — Tus objetivos</Text>
        <Text style={s.heading}>{'¿Qué querés\nlograr?'}</Text>
        <Text style={s.sub}>
          Elegí al menos {MIN_SEL}. El asesor los usa para armar tu plan.
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.gridContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.grid}>
          {OPCIONES.map(o => {
            const on = sel.has(o.id);
            return (
              <TouchableOpacity
                key={o.id}
                style={[s.card, on && s.cardOn]}
                onPress={() => toggle(o.id)}
                activeOpacity={0.75}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={`${o.titulo}, ${o.hint}`}
              >
                <View style={[s.iconBox, on && s.iconBoxOn]}>
                  <ObjIcon name={o.icon} size={20} color={on ? t.onAccent : t.ink2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitulo}>{o.titulo}</Text>
                  <Text style={s.cardHint}>{o.hint}</Text>
                </View>
                {on && (
                  <View style={s.badge}>
                    <CheckIcon color={t.onAccent} />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <View style={s.footer}>
        <View style={s.footerTop}>
          <Text style={s.footerCount}>
            {sel.size} elegido{sel.size !== 1 ? 's' : ''}
            {sel.size < MIN_SEL ? `  ·  faltan ${MIN_SEL - sel.size}` : ''}
          </Text>
          <Text style={s.footerMin}>mín. {MIN_SEL}</Text>
        </View>
        <TouchableOpacity
          style={[s.boton, (!puedeAvanzar || guardando) && s.botonDisabled]}
          onPress={continuar}
          disabled={!puedeAvanzar || guardando}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityState={{ disabled: !puedeAvanzar || guardando }}
        >
          <Text style={[s.botonTexto, !puedeAvanzar && s.botonTextoDisabled]}>
            Continuar
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function useStyles(t: typeof colors) {
  return StyleSheet.create({
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 22,
      paddingTop: 14,
      paddingBottom: 10,
    },
    pasoNum: {
      fontSize: 12,
      color: t.muted,
      fontFamily: fonts.mono,
    },
    titulo: {
      paddingHorizontal: 22,
      paddingBottom: 14,
    },
    eyebrow: {
      fontSize: 11,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      color: t.muted,
      marginBottom: 8,
      fontFamily: fonts.ui,
      fontWeight: '600',
    },
    heading: {
      fontFamily: fonts.display,
      fontStyle: 'italic',
      fontSize: 30,
      fontWeight: '400',
      lineHeight: 32,
      letterSpacing: -0.8,
      color: t.ink,
      marginBottom: 6,
    },
    sub: {
      fontSize: 13,
      lineHeight: 20,
      color: t.muted,
      fontFamily: fonts.ui,
    },
    gridContainer: {
      paddingHorizontal: 24,
      paddingBottom: 8,
    },
    backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -12 },
    grid: {
      flexDirection: 'row',
      gap: 8,
    },
    card: {
      minHeight: 68,
      paddingHorizontal: 12,
      paddingVertical: 12,
      borderRadius: br.lg,
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: t.hairline,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    cardOn: {
      backgroundColor: t.accentBg,
      borderColor: t.accent,
    },
    badge: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: t.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconBox: {
      width: 44,
      height: 44,
      borderRadius: br.md,
      backgroundColor: t.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconBoxOn: {
      backgroundColor: t.accent,
    },
    cardTitulo: {
      fontSize: 15,
      fontWeight: '600',
      color: t.ink,
      lineHeight: 20,
      fontFamily: fonts.ui,
    },
    cardHint: {
      fontSize: 13,
      color: t.ink2,
      marginTop: 2,
      fontFamily: fonts.ui,
    },
    footer: {
      paddingHorizontal: 22,
      paddingTop: 12,
      paddingBottom: 20,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.hairline,
    },
    footerTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    footerCount: {
      fontSize: 13,
      color: t.muteText,
      fontFamily: fonts.ui,
    },
    footerMin: {
      fontSize: 12,
      color: t.muted,
      fontFamily: fonts.mono,
    },
    boton: {
      height: 52,
      borderRadius: br.lg,
      backgroundColor: t.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    botonDisabled: {
      backgroundColor: t.hairline,
    },
    botonTexto: {
      fontSize: 15,
      fontWeight: '600',
      color: t.onAccent,
      fontFamily: fonts.ui,
      letterSpacing: 0.1,
    },
    botonTextoDisabled: {
      color: t.muteText,
    },
  });
}
