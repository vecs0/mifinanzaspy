// app/onboarding/_layout.tsx — Layout del flujo de onboarding
import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        gestureEnabled: true,
        contentStyle: { backgroundColor: '#FAF8F4' },
      }}
    >
      <Stack.Screen name="bienvenida" options={{ gestureEnabled: false }} />
      <Stack.Screen name="bancos" />
      <Stack.Screen name="permisos" />
    </Stack>
  );
}
