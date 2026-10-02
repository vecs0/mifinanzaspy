/**
 * onboarding/_layout.tsx
 * Responsabilidad: Layout del flujo de onboarding (Stack navigator)
 * Usado por: expo-router (onboarding layout root)
 * Depende de: ninguno
 */
import { Stack } from 'expo-router';
import { useThemeCtx } from '@/services/ThemeContext';
import { colors, colorsDark } from '@/theme/design-system';

export default function OnboardingLayout() {
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        gestureEnabled: true,
        contentStyle: { backgroundColor: t.bg },
      }}
    >
      <Stack.Screen name="bienvenida" options={{ gestureEnabled: false }} />
      <Stack.Screen name="perfil" />
      <Stack.Screen name="objetivos" />
      <Stack.Screen name="bancos" />
      <Stack.Screen name="permisos" />
    </Stack>
  );
}
