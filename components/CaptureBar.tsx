/**
 * CaptureBar
 * Responsabilidad: Accion primaria de captura rapida (escribi o hablá tu gasto)
 * Usado por: app/(tabs)/index.tsx
 * Depende de: PressableScale, ThemeContext, react-native-svg
 */
import { View, Text } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { PressableScale } from '@/components/PressableScale';
import { useThemeCtx } from '@/services/ThemeContext';
import { colors, colorsDark, borderRadius as br, iconStroke } from '@/theme/design-system';

interface Props {
  onPress: () => void;
}

export function CaptureBar({ onPress }: Props) {
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel="Registrar un gasto. Escribí o hablá tu gasto"
      pressedScale={0.985}
      style={{
        minHeight: 56, borderRadius: br.xl, paddingLeft: 20, paddingRight: 8,
        backgroundColor: t.accent, flexDirection: 'row', alignItems: 'center', gap: 12,
      }}
    >
      <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: t.onAccent, fontFamily: 'Geist' }} numberOfLines={1}>
        Escribí o hablá tu gasto
      </Text>
      <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: t.accentBg }}>
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={t.onAccent} strokeWidth={iconStroke} strokeLinecap="round" strokeLinejoin="round">
          <Rect x="9" y="3" width="6" height="11" rx="3" />
          <Path d="M5 11a7 7 0 0014 0M12 18v3" />
        </Svg>
      </View>
    </PressableScale>
  );
}
