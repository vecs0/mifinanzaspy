/**
 * CategoriaChip
 * Responsabilidad: Chip de categoria con icono y color
 * Usado por: TransactionRow, QuickAddModal
 * Depende de: categories (CATEGORIA_POR_ID), Icon, ThemeContext
 */
import { View, Text, StyleSheet } from 'react-native';
import { CATEGORIA_POR_ID } from '@/constants/categories';
import { Icon } from '@/components/Icon';
import { useThemeCtx } from '@/services/ThemeContext';
import { colors, colorsDark } from '@/theme/design-system';

interface Props {
  categoriaId: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const DIMS = { sm: 28, md: 36, lg: 44 };
const ICON_SIZE = { sm: 12, md: 16, lg: 20 };
const LABEL_SIZE = { sm: 10, md: 11, lg: 12 };

export function CategoriaChip({ categoriaId, size = 'md', showLabel }: Props) {
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;
  const cat = CATEGORIA_POR_ID[categoriaId];
  const dim = DIMS[size];
  const tinte = cat?.tinte ?? t.muted;

  return (
    <View style={[s.row, { gap: 6 }]}>
      <View
        style={[
          s.circle,
          {
            width: dim,
            height: dim,
            borderRadius: dim / 2,
            backgroundColor: `${tinte}18`,
          },
        ]}
      >
        {cat ? (
          <Icon name={cat.icono} size={ICON_SIZE[size]} color={tinte} />
        ) : (
          <Text style={[s.dot, { color: tinte, fontSize: ICON_SIZE[size] }]}>•</Text>
        )}
      </View>
      {showLabel && cat && (
        <Text
          style={[
            s.label,
            {
              fontSize: LABEL_SIZE[size],
              color: t.ink,
            },
          ]}
          numberOfLines={1}
        >
          {cat.nombre}
        </Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    overflow: 'hidden',
  },
  dot: {
    fontWeight: '700',
  },
  label: {
    fontWeight: '500',
  },
});
