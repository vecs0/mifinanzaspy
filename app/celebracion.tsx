/**
 * celebracion.tsx
 * Responsabilidad: Pantalla de celebración al lograr ahorro semanal
 * Usado por: crecer.tsx (router.push)
 * Depende de: ThemeContext
 */
import { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Share,
  Animated, Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useThemeCtx } from '@/services/ThemeContext';
import { colors, colorsDark, fonts, borderRadius as br } from '@/theme/design-system';

function fmtGsFull(n: number): string {
  return n.toLocaleString('es-PY').replace(/,/g, '.');
}

interface MetaAhorro {
  titulo: string;
  aportado: number;
  pct: number;
}

function CoinAnimada({ size = 110 }: { size?: number }) {
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;
  const scale = useRef(new Animated.Value(0.7)).current;
  const glow  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(scale, {
        toValue: 1, friction: 5, tension: 60, useNativeDriver: true,
      }),
      Animated.loop(
        Animated.sequence([
          Animated.timing(glow, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(glow, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      ),
    ]).start();
  }, []);

  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.65] });

  return (
    <Animated.View style={{ transform: [{ scale }], alignItems: 'center', justifyContent: 'center' }}>
      {/* Halo exterior */}
      <Animated.View style={[{ position: 'absolute', backgroundColor: 'rgba(179,106,42,0.3)' }, { opacity: glowOpacity, width: size + 40, height: size + 40, borderRadius: (size + 40) / 2 }]} />
      {/* Moneda */}
      <View style={{ alignItems: 'center', justifyContent: 'center',
          shadowColor: t.accent, shadowOffset: { width: 0, height: 20 },
          shadowOpacity: 0.4, shadowRadius: 40, elevation: 12,
          backgroundColor: '#D4973B', width: size, height: size, borderRadius: size / 2 }}>
        <Text style={{ fontFamily: fonts.display, fontStyle: 'italic',
            fontSize: 72, lineHeight: 80, letterSpacing: -2, color: t.bg }}>₲</Text>
      </View>
    </Animated.View>
  );
}

// coin styles defined inline in CoinAnimada

function ProgressStrip({ titulo, aportado, pct, t, accent }: {
  titulo: string; aportado: number; pct: number; t: typeof colors; accent: string;
}) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: pct / 100,
      duration: 800,
      delay: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, []);

  const width = anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', `${Math.min(100, pct)}%`] });

  return (
    <View style={[ps.wrap, { backgroundColor: t.card, borderColor: t.hairline }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <Text style={[ps.titulo, { color: t.ink }]} numberOfLines={1}>{titulo}</Text>
        <Text style={[ps.monto, { color: t.positive }]}>+Gs {fmtGsFull(aportado)}</Text>
      </View>
      <View style={[ps.track, { backgroundColor: t.hairline }]}>
        <Animated.View style={[ps.fill, { width, backgroundColor: accent }]} />
      </View>
    </View>
  );
}

const ps = StyleSheet.create({
  wrap:   { padding: 12, borderRadius: br.md, borderWidth: 1 },
  titulo: { fontSize: 12.5, fontWeight: '600', flex: 1, fontFamily: fonts.ui },
  monto:  { fontSize: 11.5, fontWeight: '600', fontFamily: fonts.mono, marginLeft: 8 },
  track:  { height: 4, borderRadius: 2, overflow: 'hidden' },
  fill:   { height: '100%', borderRadius: 2 },
});

export default function CelebracionScreen() {
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;
  const accent = t.accent;
  const router = useRouter();
  const params = useLocalSearchParams<{ monto?: string; metas?: string; bajoPct?: string }>();
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(slideUp, { toValue: 0, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);

  // Parseamos params con fallbacks de demo
  const monto = params.monto ? Math.max(0, parseInt(params.monto, 10) || 0) : 1_250_000;
  const bajoPct = params.bajoPct ? Math.max(0, parseInt(params.bajoPct, 10) || 0) : 22;

  let metasRaw: MetaAhorro[] = [
    { titulo: 'Fondo de urgencia',   aportado: 800_000, pct: 50 },
    { titulo: 'Viaje a Encarnación', aportado: 450_000, pct: 50 },
  ];
  try {
    if (params.metas) {
      const parsed = JSON.parse(params.metas);
      if (Array.isArray(parsed) && parsed.length > 0) {
        metasRaw = parsed;
      }
    }
  } catch { console.warn('[celebracion] Error parseando metas desde params'); }

  const esDemo = !params.metas || !params.monto || monto <= 0;
  const nMetas = metasRaw.length;
  const cuerpo = !esDemo && nMetas === 2
    ? `Movimos Gs ${fmtGsFull(metasRaw[0].aportado)} al ${metasRaw[0].titulo} y Gs ${fmtGsFull(metasRaw[1].aportado)} al ${metasRaw[1].titulo}. Bajaste un ${bajoPct}% el delivery — ¡bien ahí!`
    : !esDemo && nMetas > 0
      ? `Distribuimos el ahorro entre tus ${nMetas} metas activas. ¡Seguí así!`
      : 'No tenés metas activas todavía. Creá una para empezar a ahorrar.';

  function compartir() {
    Share.share({
      message: `¡Ahorré Gs ${fmtGsFull(monto)} esta semana con MiFinanzasPY! 💰 ${cuerpo}`,
    });
  }

  return (
    <SafeAreaView style={[s.flex, { backgroundColor: t.bg }]}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"
            stroke={t.ink2} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M18 6L6 18M6 6l12 12" />
          </Svg>
        </TouchableOpacity>
        {!esDemo && (
          <TouchableOpacity onPress={compartir}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"
              stroke={t.ink2} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
            </Svg>
          </TouchableOpacity>
        )}
      </View>

      <Animated.View style={[s.center, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}>
        {/* Moneda con halo */}
        <CoinAnimada />

        {/* Monto */}
        <View style={{ alignItems: 'center', marginTop: 28, marginBottom: 12 }}>
          <Text style={[s.eyebrow, { color: accent }]}>Ahorraste esta semana</Text>
          <Text style={[s.montoHero, { color: t.ink }]}>
            +Gs{'\n'}{fmtGsFull(monto)}
          </Text>
          <Text style={[s.cuerpo, { color: t.ink2 }]}>{cuerpo}</Text>
        </View>

        {/* Tiras de progreso por meta */}
        {!esDemo && (
          <View style={s.strips}>
            {metasRaw.map((m, i) => (
              <ProgressStrip
                key={i}
                titulo={m.titulo}
                aportado={m.aportado}
                pct={m.pct}
                t={t}
                accent={accent}
              />
            ))}
          </View>
        )}
      </Animated.View>

      <View style={s.footer}>
        <TouchableOpacity
          style={[s.btn, { backgroundColor: accent }]}
          onPress={() => router.back()}
          activeOpacity={0.85}
        >
          <Text style={[s.btnTxt, { color: t.bg }]}>Seguir así</Text>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none"
            stroke={t.bg} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M5 12h14M12 5l7 7-7 7" />
          </Svg>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 22, paddingTop: 8, paddingBottom: 8,
  },
  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 28,
  },
  eyebrow: {
    fontSize: 10.5, letterSpacing: 1.2, textTransform: 'uppercase',
    fontWeight: '600', fontFamily: fonts.ui, marginBottom: 8,
  },
  montoHero: {
    fontFamily: fonts.display, fontStyle: 'italic', fontWeight: '400',
    fontSize: 58, lineHeight: 56, letterSpacing: -2.2,
    textAlign: 'center', marginBottom: 12,
  },
  cuerpo: {
    fontSize: 14, lineHeight: 22, textAlign: 'center', fontFamily: fonts.ui,
    maxWidth: 300, marginBottom: 24,
  },
  strips: { width: '100%', gap: 10 },
  footer: {
    paddingHorizontal: 22, paddingBottom: 24, paddingTop: 12,
  },
  btn: {
    height: 52, borderRadius: br.lg,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  btnTxt: {
    fontSize: 15, fontWeight: '600', fontFamily: fonts.ui,
  },
});
