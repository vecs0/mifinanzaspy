/**
 * Eyebrow
 * Responsabilidad: Label decorativo small caps (eyebrow)
 * Usado por: index, duplicados, importar, scan, AlertsList
 * Depende de: ThemeContext
 */
import { Text, StyleSheet, type TextStyle } from 'react-native';
import { useThemeCtx } from '@/services/ThemeContext';
import { colors, colorsDark } from '@/theme/design-system';

interface Props {
  label: string;
  style?: TextStyle;
}

export function Eyebrow({ label, style }: Props) {
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;
  return (
    <Text style={[s.base, { color: t.muteText }, style]}>
      {label}
    </Text>
  );
}

const s = StyleSheet.create({
  base: {
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
});
