/**
 * celebracion.tsx
 * Responsabilidad: Pantalla al cumplir una meta de ahorro (usa los params titulo y monto)
 * Usado por: crecer.tsx (router.push)
 * Depende de: ThemeContext
 */
import { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Share,
  Animated, Easing,
} from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useThemeCtx } from '@/services/ThemeContext';
import { colors, colorsDark, fonts, borderRadius as br, iconStroke, hit, motion } from '@/theme/design-system';

function fmtGsFull(n: number): string {
  return n.toLocaleString('es-PY').replace(/,/g, '.');
}

function Moneda({ size = 104, t }: { size?: number; t: typeof colors }) {
  const reduce = useReducedMotion();
  const scale = useRef(new Animated.Value(reduce ? 1 : 0.8)).current;

  useEffect(() => {
    if (reduce) return;
    Animated.timing(scale, {
      toValue: 1, duration: motion.slow, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View style={{ transform: [{ scale }], alignItems: 'center', justifyContent: 'center' }}>
      <View style={{
        width: size + 32, height: size + 32, borderRadius: (size + 32) / 2,
        backgroundColor: t.accentBg, alignItems: 'center', justifyContent: 'center',
      }}>
        <View style={{
          width: size, height: size, borderRadius: size / 2, backgroundColor: t.accent,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ fontFamily: fonts.display, fontStyle: 'italic', fontSize: 64, lineHeight: 72, color: t.onAccent }}>₲</Text>
        </View>
      </View>
    </Animated.View>
  );
}

export default function CelebracionScreen() {
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;
  const router = useRouter();
  const params = useLocalSearchParams<{ titulo?: string; monto?: string }>();
  const reduce = useReducedMotion();
  const fadeIn = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  const slideUp = useRef(new Animated.Value(reduce ? 0 : 16)).current;

  useEffect(() => {
    if (reduce) return;
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: motion.slow, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(slideUp, { toValue: 0, duration: motion.slow, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);

  const titulo = params.titulo?.trim() ?? '';
  const monto = params.monto ? Math.max(0, parseInt(params.monto, 10) || 0) : 0;
  const hayMeta = titulo.length > 0 && monto > 0;

  function compartir() {
    Share.share({
      message: `Cumplí mi meta "${titulo}" de Gs ${fmtGsFull(monto)} con MiFinanzasPY.`,
    }).catch(() => {});
  }

  return (
    <SafeAreaView style={[s.flex, { backgroundColor: t.bg }]}>
      <View style={s.topBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={hit}
          style={s.iconBtn}
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
        >
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none"
            stroke={t.ink2} strokeWidth={iconStroke} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M18 6L6 18M6 6l12 12" />
          </Svg>
        </TouchableOpacity>
        {hayMeta && (
          <TouchableOpacity
            onPress={compartir}
            hitSlop={hit}
            style={s.iconBtn}
            accessibilityRole="button"
            accessibilityLabel="Compartir logro"
          >
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none"
              stroke={t.ink2} strokeWidth={iconStroke} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
            </Svg>
          </TouchableOpacity>
        )}
      </View>

      <Animated.View style={[s.center, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}>
        {hayMeta ? (
          <>
            <Moneda t={t} />
            <View style={{ alignItems: 'center', marginTop: 32 }}>
              <Text style={[s.eyebrow, { color: t.accent }]}>Meta cumplida</Text>
              <Text style={[s.titulo, { color: t.ink }]} accessibilityRole="header">{titulo}</Text>
              <Text style={[s.monto, { color: t.ink }]}>Gs {fmtGsFull(monto)}</Text>
              <Text style={[s.cuerpo, { color: t.ink2 }]}>
                Llegaste al 100% de tu objetivo. Podés crear otra meta cuando quieras.
              </Text>
            </View>
          </>
        ) : (
          <View style={{ alignItems: 'center' }}>
            <Text style={[s.titulo, { color: t.ink }]} accessibilityRole="header">Todavía no hay nada para celebrar</Text>
            <Text style={[s.cuerpo, { color: t.ink2 }]}>
              Cuando cumplas una meta de ahorro, la vas a ver acá.
            </Text>
          </View>
        )}
      </Animated.View>

      <View style={s.footer}>
        <TouchableOpacity
          style={[s.btn, { backgroundColor: t.accent }]}
          onPress={() => router.back()}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={hayMeta ? 'Seguir' : 'Volver'}
        >
          <Text style={[s.btnTxt, { color: t.onAccent }]}>{hayMeta ? 'Seguir' : 'Volver'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 12, paddingTop: 4,
  },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32,
  },
  eyebrow: {
    fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase',
    fontWeight: '600', fontFamily: fonts.ui, marginBottom: 8,
  },
  titulo: {
    fontFamily: fonts.display, fontStyle: 'italic', fontWeight: '400',
    fontSize: 30, lineHeight: 34, letterSpacing: -0.6,
    textAlign: 'center', marginBottom: 12,
  },
  monto: {
    fontFamily: fonts.mono, fontSize: 28, fontWeight: '600', letterSpacing: -0.8,
    textAlign: 'center', marginBottom: 16, fontVariant: ['tabular-nums'],
  },
  cuerpo: {
    fontSize: 15, lineHeight: 22, textAlign: 'center', fontFamily: fonts.ui,
    maxWidth: 300,
  },
  footer: {
    paddingHorizontal: 24, paddingBottom: 24, paddingTop: 12,
  },
  btn: {
    minHeight: 52, borderRadius: br.lg,
    alignItems: 'center', justifyContent: 'center',
  },
  btnTxt: {
    fontSize: 16, fontWeight: '600', fontFamily: fonts.ui,
  },
});
