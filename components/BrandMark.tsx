/**
 * BrandMark
 * Responsabilidad: Logotipo de la app "Mi Finanzas PY" en texto
 * Usado por: QuickAddModal
 * Depende de: ThemeContext
 */
import { Text, StyleSheet, type TextStyle } from 'react-native';
import { useThemeCtx } from '@/services/ThemeContext';
import { colors, colorsDark } from '@/theme/design-system';

interface Props {
  size?: 'hero' | 'large' | 'small';
  style?: TextStyle;
}

const SIZES = {
  hero:  { fontSize: 36, lineHeight: 38 },
  large: { fontSize: 26, lineHeight: 28 },
  small: { fontSize: 18, lineHeight: 20 },
} as const;

export function BrandMark({ size = 'large', style }: Props) {
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;
  return (
    <Text
      style={[
        s.base,
        SIZES[size],
        { color: t.ink },
        style,
      ]}
    >
      MiFinanzasPY
    </Text>
  );
}

const s = StyleSheet.create({
  base: {
    fontFamily: 'Newsreader-Italic',
    fontStyle: 'italic',
    fontWeight: '400',
    letterSpacing: -0.7,
  },
});
