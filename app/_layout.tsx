// app/_layout.tsx — Root layout con Expo Router
// NOTA: useRouter() NO puede usarse para redireccionar desde el root layout
// antes de que el navigator esté montado. Se usa el patrón correcto con
// un componente interno que ya vive dentro del Stack.

// NativeWind v4: importar global.css UNA SOLA VEZ aquí (punto de entrada CSS)
import '../global.css';

import { useCallback, useEffect, useState } from 'react';
import { Stack, Redirect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { getOnboarding } from '@/services/database';
import { iniciarEscuchaSMS, importarHistorialSMS } from '@/services/smsService';
import { iniciarEscuchaNotificaciones } from '@/services/notificationService';

SplashScreen.preventAutoHideAsync();

type AppState = 'loading' | 'onboarding' | 'app';

export default function RootLayout() {
  const [estado, setEstado] = useState<AppState>('loading');

  const [fontsLoaded] = useFonts({
    'Newsreader-Italic': require('@/assets/fonts/Newsreader-Italic.ttf'),
    'Geist': require('@/assets/fonts/Geist-Regular.ttf'),
    'GeistMono': require('@/assets/fonts/GeistMono-Regular.ttf'),
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded && estado !== 'loading') {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded, estado]);

  useEffect(() => {
    async function arrancar() {
      try {
        const onboarding = await getOnboarding();
        const listo = onboarding.completado;
        setEstado(listo ? 'app' : 'onboarding');

        if (listo) {
          iniciarEscuchaSMS();
          iniciarEscuchaNotificaciones();
          importarHistorialSMS().catch(console.warn);
        }
      } catch (e) {
        console.error('Error al inicializar app:', e);
        setEstado('onboarding');
      }
    }
    arrancar();
  }, []);

  useEffect(() => {
    onLayoutRootView();
  }, [onLayoutRootView]);

  if (estado === 'loading' || !fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" backgroundColor="#FAF8F4" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="+not-found" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="onboarding"
            options={{ animation: 'fade', gestureEnabled: false }}
          />
          <Stack.Screen
            name="transaccion/[id]"
            options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
          />
          <Stack.Screen
            name="transaccion/settings"
            options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
          />
        </Stack>
        {estado === 'onboarding' && <Redirect href="/onboarding/bienvenida" />}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
