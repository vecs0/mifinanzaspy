/**
 * PressableScale
 * Responsabilidad: Boton con feedback de presion (opacity + scale) que respeta reduced motion
 * Usado por: index, CaptureBar, EmptyState, InlineError
 * Depende de: reanimated, design-system (motion, hit)
 */
import type { ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, useReducedMotion, Easing,
} from 'react-native-reanimated';
import { hit, motion } from '@/theme/design-system';

interface Props extends Omit<PressableProps, 'style' | 'children'> {
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
  pressedScale?: number;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function PressableScale({ style, children, pressedScale = 0.97, onPressIn, onPressOut, hitSlop, ...rest }: Props) {
  const reduce = useReducedMotion();
  const p = useSharedValue(0);

  const anim = useAnimatedStyle(() => ({
    opacity: 1 - p.value * 0.15,
    transform: [{ scale: reduce ? 1 : 1 - p.value * (1 - pressedScale) }],
  }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      hitSlop={hitSlop ?? hit}
      {...rest}
      onPressIn={(e) => {
        p.value = withTiming(1, { duration: motion.press, easing: Easing.out(Easing.quad) });
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        p.value = withTiming(0, { duration: motion.fast, easing: Easing.out(Easing.quad) });
        onPressOut?.(e);
      }}
      style={[style, anim]}
    >
      {children}
    </AnimatedPressable>
  );
}
