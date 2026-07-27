/**
 * Eyebrow
 * Responsabilidad: Label decorativo small caps (eyebrow)
 * Usado por: index, duplicados, importar, scan, AlertsList
 * Depende de: ThemeContext
 */
import { Text, StyleSheet, type TextStyle } from 'react-native';
import { useThemeCtx } from '@/services/ThemeContext';

interface Props {
  label: string;
  style?: TextStyle;
}

export function Eyebrow({ label, style }: Props) {
  const { dark } = useThemeCtx();
  return (
    <Text style={[s.base, { color: dark ? 'rgba(241,237,230,0.6)' : '#9B8E84' }, style]}>
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
