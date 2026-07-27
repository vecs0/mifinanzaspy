/**
 * Money
 * Responsabilidad: Formateo visual de montos PYG (enteros)
 * Usado por: BankCard, TransactionRow, banco/[id], duplicados
 * Depende de: ThemeContext
 */
import { Text, StyleSheet, type TextStyle } from 'react-native';
import { useThemeCtx } from '@/services/ThemeContext';

type MoneySize = 'hero' | 'large' | 'medium' | 'small';

interface Props {
  amount: number;
  currency?: 'PYG' | 'USD';
  size?: MoneySize;
  sign?: 'always' | 'auto' | 'never';
  style?: TextStyle;
}

const SIZES: Record<MoneySize, TextStyle> = {
  hero:   { fontSize: 36, lineHeight: 38, fontWeight: '500', letterSpacing: -1.2 },
  large:  { fontSize: 20, lineHeight: 22, fontWeight: '600', letterSpacing: -0.5 },
  medium: { fontSize: 16, lineHeight: 18, fontWeight: '600', letterSpacing: -0.3 },
  small:  { fontSize: 14, lineHeight: 16, fontWeight: '600' },
};

function formatAmount(amount: number, currency: 'PYG' | 'USD'): string {
  const abs = Math.abs(amount);
  if (currency === 'USD') {
    return `USD ${abs.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  }
  return `Gs ${abs.toLocaleString('es-PY')}`;
}

function getSign(amount: number, mode: 'always' | 'auto' | 'never'): string {
  if (mode === 'never') return '';
  if (amount === 0) return '';
  if (mode === 'always') return amount > 0 ? '+' : '−';
  return '';
}

export function Money({ amount, currency = 'PYG', size = 'medium', sign = 'auto', style }: Props) {
  const { dark } = useThemeCtx();
  const isNegative = amount < 0;
  const prefix = getSign(amount, sign);

  const textColor = amount === 0
    ? (dark ? '#C5BDB5' : '#9B8E84')
    : isNegative
      ? (dark ? '#E57A5E' : '#A8401F')
      : (dark ? '#9FE0B5' : '#3F8E5A');

  return (
    <Text style={[s.base, SIZES[size], { color: textColor }, style]}>
      {prefix}{prefix ? ' ' : ''}{formatAmount(amount, currency)}
    </Text>
  );
}

const s = StyleSheet.create({
  base: {
    fontFamily: 'GeistMono',
  },
});
