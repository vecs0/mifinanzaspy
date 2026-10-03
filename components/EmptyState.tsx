/**
 * EmptyState
 * Responsabilidad: Estado vacio que explica que hacer a continuacion
 * Usado por: index, historial, crecer, presupuestos, recordatorios
 * Depende de: PressableScale, ThemeContext
 */
import { View, Text } from 'react-native';
import { PressableScale } from '@/components/PressableScale';
import { useThemeCtx } from '@/services/ThemeContext';
import { colors, colorsDark, borderRadius as br } from '@/theme/design-system';

interface Props {
  titulo: string;
  texto: string;
  accion?: string;
  onAccion?: () => void;
}

export function EmptyState({ titulo, texto, accion, onAccion }: Props) {
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;
  return (
    <View style={{ alignItems: 'center', paddingVertical: 32, paddingHorizontal: 24, gap: 8 }}>
      <Text style={{ fontSize: 16, fontWeight: '600', color: t.ink, fontFamily: 'Geist', textAlign: 'center' }}>{titulo}</Text>
      <Text style={{ fontSize: 14, lineHeight: 20, color: t.ink2, fontFamily: 'Geist', textAlign: 'center' }}>{texto}</Text>
      {accion && onAccion && (
        <PressableScale
          onPress={onAccion}
          accessibilityLabel={accion}
          style={{
            marginTop: 8, minHeight: 44, paddingHorizontal: 20, borderRadius: br.md,
            backgroundColor: t.accentBg, alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: '600', color: t.accent, fontFamily: 'Geist' }}>{accion}</Text>
        </PressableScale>
      )}
    </View>
  );
}
