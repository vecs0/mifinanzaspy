/**
 * BankChip
 * Responsabilidad: Chip visual con logo y nombre de banco
 * Usado por: app/(tabs)/index.tsx
 * Depende de: banks (BANCO_POR_ID), BankLogo, ThemeContext
 */
import { View, Text } from 'react-native';
import { BANCO_POR_ID } from '@/constants/banks';
import { BankLogo } from '@/components/BankLogo';
import { useThemeCtx } from '@/services/ThemeContext';
import { colors, colorsDark } from '@/theme/design-system';

interface Props {
  bancoId: string;
  size?: 'sm' | 'md';
  showName?: boolean;
}

const DIMS = { sm: 24, md: 32 };

export function BankChip({ bancoId, size = 'md', showName = true }: Props) {
  const banco = BANCO_POR_ID[bancoId];
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <BankLogo bancoId={bancoId} size={DIMS[size]} />
      {showName && banco && (
        <Text style={{ fontSize: size === 'sm' ? 11 : 12.5, fontWeight: '500', color: t.ink }} numberOfLines={1}>
          {banco.corto}
        </Text>
      )}
    </View>
  );
}
