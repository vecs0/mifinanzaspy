/**
 * SplashVideo
 * Responsabilidad: Pantalla splash animada con logo y video
 * Usado por: app/_layout.tsx
 * Depende de: assets locales (video/imagen)
 */
import { useEffect, useRef } from 'react';
import { View, Text, Image, Animated, StyleSheet, Dimensions, Easing, useColorScheme } from 'react-native';
import { colors, colorsDark } from '@/theme/design-system';

const { width, height } = Dimensions.get('window');

const ICON_SIZE = 118;

interface Props {
  onReady?: () => void;
}

export default function SplashLogo({ onReady }: Props) {
  const scheme = useColorScheme();
  const c      = scheme === 'dark' ? colorsDark : colors;
  const t      = { bg: c.bg, ink: c.ink, muted: c.muted, glowA: c.accentBg, glowB: c.accentBg, shadow: c.shadow };

  const glowOp    = useRef(new Animated.Value(0)).current;
  const glowScale = useRef(new Animated.Value(0.55)).current;

  const iconOp    = useRef(new Animated.Value(0)).current;
  const iconY     = useRef(new Animated.Value(44)).current;
  const iconScale = useRef(new Animated.Value(0.68)).current;

  const titleOp   = useRef(new Animated.Value(0)).current;
  const titleY    = useRef(new Animated.Value(18)).current;

  const tagOp     = useRef(new Animated.Value(0)).current;

  const pulse     = useRef(new Animated.Value(1)).current;

  const sp = (v: Animated.Value, to: number, ten = 78, fri = 9) =>
    Animated.spring(v, { toValue: to, tension: ten, friction: fri, useNativeDriver: true });

  const tm = (v: Animated.Value, to: number, ms: number, ease?: typeof Easing.linear) =>
    Animated.timing(v, { toValue: to, duration: ms, easing: ease ?? Easing.out(Easing.cubic), useNativeDriver: true });

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        tm(glowOp,    1, 560, Easing.out(Easing.quad)),
        tm(glowScale, 1, 720, Easing.out(Easing.quad)),
      ]),
      Animated.parallel([
        sp(iconScale, 1, 72, 8),
        tm(iconOp,    1, 200, Easing.out(Easing.quad)),
        sp(iconY,     0, 72, 9),
      ]),
      Animated.delay(100),
      Animated.parallel([
        tm(titleOp, 1, 360, Easing.out(Easing.cubic)),
        sp(titleY,  0, 58, 12),
      ]),
      tm(tagOp, 1, 280, Easing.out(Easing.cubic)),
    ]).start(() => {
      Animated.loop(
        Animated.sequence([
          tm(pulse, 1.016, 1400, Easing.inOut(Easing.sin)),
          tm(pulse, 1,     1400, Easing.inOut(Easing.sin)),
        ])
      ).start();
      setTimeout(() => onReady?.(), 800);
    });
  }, []);

  return (
    <View style={[s.container, { backgroundColor: t.bg }]}>
      <Animated.View style={[s.glowA, { backgroundColor: t.glowA, opacity: glowOp, transform: [{ scale: glowScale }] }]} />
      <Animated.View style={[s.glowB, { backgroundColor: t.glowB, opacity: glowOp, transform: [{ scale: glowScale }] }]} />

      <Animated.View style={[
        s.iconEntry,
        { opacity: iconOp, transform: [{ translateY: iconY }, { scale: iconScale }], shadowColor: t.shadow },
      ]}>
        <Animated.View style={{ transform: [{ scale: pulse }] }}>
          <View style={s.iconCard}>
            <Image
              source={require('@/assets/icon.png')}
              style={s.iconImg}
              resizeMode="contain"
            />
          </View>
        </Animated.View>
      </Animated.View>

      <Animated.View style={[s.titleWrap, { opacity: titleOp, transform: [{ translateY: titleY }] }]}>
        <Text style={[s.title, { color: t.ink }]}>
          <Text style={{ color: c.ink }}>Mi</Text>
          {'Finanzas'}
          <Text style={{ color: c.accent }}>PY</Text>
        </Text>
      </Animated.View>

      <Animated.View style={[s.tagWrap, { opacity: tagOp }]}>
        <View style={[s.dot, { backgroundColor: c.accent }]} />
        <Text style={[s.tag, { color: t.muted }]}>Controlá tu dinero</Text>
        <View style={[s.dot, { backgroundColor: c.accent }]} />
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowA: {
    position: 'absolute',
    width:  width * 0.88,
    height: width * 0.88,
    borderRadius: width * 0.44,
    top: height * 0.06,
    alignSelf: 'center',
  },
  glowB: {
    position: 'absolute',
    width:  width * 0.55,
    height: width * 0.55,
    borderRadius: width * 0.275,
    top: height * 0.20,
    right: -width * 0.05,
  },
  iconEntry: {
    marginBottom: 30,
    shadowOffset:  { width: 0, height: 14 },
    shadowOpacity: 0.18,
    shadowRadius:  32,
    elevation: 14,
  },
  iconCard: {
    width:  ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: 26,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  iconImg: {
    width:  ICON_SIZE,
    height: ICON_SIZE,
  },
  titleWrap: {
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  tagWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    opacity: 0.7,
  },
  tag: {
    fontSize: 12.5,
    letterSpacing: 0.3,
  },
});
