/**
 * InlineError
 * Responsabilidad: Mensaje de error en linea con accion de reintento
 * Usado por: index, historial, reportes, meta/nueva
 * Depende de: PressableScale, ThemeContext
 */
import { View, Text } from 'react-native';
import { PressableScale } from '@/components/PressableScale';
import { useThemeCtx } from '@/services/ThemeContext';
import { colors, colorsDark, borderRadius as br } from '@/theme/design-system';

interface Props {
  mensaje: string;
  onReintentar?: () => void;
}

export function InlineError({ mensaje, onReintentar }: Props) {
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;
  return (
    <View
      accessibilityRole="alert"
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 12,
        padding: 12, borderRadius: br.md, backgroundColor: t.negativeBg,
      }}
    >
      <Text style={{ flex: 1, fontSize: 13, lineHeight: 18, color: t.negative, fontFamily: 'Geist' }}>{mensaje}</Text>
      {onReintentar && (
        <PressableScale
          onPress={onReintentar}
          accessibilityLabel="Reintentar"
          style={{ minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 }}
        >
          <Text style={{ fontSize: 13, fontWeight: '600', color: t.negative, fontFamily: 'Geist' }}>Reintentar</Text>
        </PressableScale>
      )}
    </View>
  );
}
