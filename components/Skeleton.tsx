/**
 * Skeleton
 * Responsabilidad: Placeholder de carga con pulso suave (estatico si reduced motion)
 * Usado por: index, historial, reportes
 * Depende de: reanimated, ThemeContext
 */
import { useEffect } from 'react';
import { View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, useReducedMotion, Easing,
} from 'react-native-reanimated';
import { useThemeCtx } from '@/services/ThemeContext';
import { colors, colorsDark, borderRadius as br } from '@/theme/design-system';

interface Props {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

export function Skeleton({ width = '100%', height = 16, radius = br.sm, style }: Props) {
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;
  const reduce = useReducedMotion();
  const o = useSharedValue(1);

  useEffect(() => {
    if (reduce) { o.value = 0.7; return; }
    o.value = withRepeat(withTiming(0.45, { duration: 900, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [reduce, o]);

  const anim = useAnimatedStyle(() => ({ opacity: o.value }));

  return (
    <Animated.View
      accessible={false}
      style={[{ width, height, borderRadius: radius, backgroundColor: t.hairline }, anim, style]}
    />
  );
}

export function SkeletonRows({ count = 4 }: { count?: number }) {
  return (
    <View accessibilityLabel="Cargando" style={{ gap: 16 }}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Skeleton width={40} height={40} radius={20} />
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton width="60%" height={14} />
            <Skeleton width="35%" height={12} />
          </View>
          <Skeleton width={72} height={14} />
        </View>
      ))}
    </View>
  );
}
