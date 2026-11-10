import '../global.css';

/**
 * _layout.tsx
 * Responsabilidad: Root layout — providers, splash, onboarding vs app decision
 * Usado por: expo-router (root)
 * Depende de: database, encryption, smsService, notificationService, ThemeContext, reminders, metas
 */
import { useEffect, useState, useContext, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, useColorScheme, AppState, type AppStateStatus } from 'react-native';
import { Stack, Redirect, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import * as Updates from 'expo-updates';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { getOnboarding, getDB, getConfig, setConfig, notifBienvenidaPendiente, insertarNotificacion, migrarCamposCifrados } from '@/services/database';
import { precargarClave } from '@/services/encryption';
import { iniciarEscuchaSMS, importarHistorialSMS } from '@/services/smsService';
import { iniciarEscuchaNotificaciones, programarRecordatorioDiario, programarReporteSemanal } from '@/services/notificationService';
import { ThemeProvider, ThemeContext } from '@/services/ThemeContext';
import { initReminderChannel } from '@/services/reminders';
import { clearDemoMetas } from '@/services/metas';
import { consumirSalidaSolicitada } from '@/services/salidaApp';
import { SMS_HABILITADO } from '@/constants/features';
import { colors, colorsDark } from '@/theme/design-system';
import SplashLogo from '@/components/SplashVideo';
import ErrorBoundary from '@/components/ErrorBoundary';
import { FloatingNotificationProvider } from '@/components/FloatingNotification';
import DeepLinkCaptura from '@/components/DeepLinkCaptura';

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: '(tabs)',
};

type AppStatus = 'loading' | 'onboarding' | 'app';

function StatusBarWrapper() {
  const { dark } = useContext(ThemeContext);
  return (
    <StatusBar
      style={dark ? 'light' : 'dark'}
      backgroundColor={dark ? '#161310' : '#FAF8F4'}
      translucent={false}
      hidden={false}
    />
  );
}

export default function RootLayout() {
  const [estado, setEstado] = useState<AppStatus>('loading');
  const [updateBanner, setUpdateBanner] = useState(false);

  // Splash orchestration: wait for fonts+state AND the JS splash animation
  const [appReady, setAppReady] = useState(false);
  const [splashAnimDone, setSplashAnimDone] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  const splashOpacity = useRef(new Animated.Value(1)).current;
  const splashNativoOculto = useRef(false);

  const scheme = useColorScheme();
  const splashBg = (scheme === 'dark' ? colorsDark : colors).bg;

  const ocultarSplashNativo = () => {
    if (splashNativoOculto.current) return;
    splashNativoOculto.current = true;
    SplashScreen.hideAsync().catch(() => {});
  };

  const [fontsLoaded] = useFonts({
    'Newsreader-Italic': require('@/assets/fonts/Newsreader-Italic.ttf'),
    'Geist': require('@/assets/fonts/Geist-Regular.ttf'),
    'GeistMono': require('@/assets/fonts/GeistMono-Regular.ttf'),
  });

  useEffect(() => {
    async function arrancar() {
      try {
        if (!__DEV__) {
          const update = await Updates.checkForUpdateAsync();
          if (update.isAvailable) setUpdateBanner(true);
        }
        const onboarding = getOnboarding();
        const listo = onboarding.completado;
        if (!listo) {
          getDB().execSync('DELETE FROM cuentas');
          setConfig('bancos_seleccionados', '');
          setConfig('banco_manual_nombre', '');
        }

        try {
          await precargarClave();
          migrarCamposCifrados();
        } catch (e) {
          console.warn('[_layout] No se pudo precargar la clave de cifrado:', e);
        }

        setEstado(listo ? 'app' : 'onboarding');

        if (listo) {
          clearDemoMetas();
          if (notifBienvenidaPendiente()) {
            insertarNotificacion(
              '¡Bienvenido a MiFinanzasPY!',
              'Ahora podés registrar tus gastos e ingresos, recibir alertas automáticas de tus bancos y consultar a tu asesor IA. Tocá "Entendido" para empezar.',
              'bienvenida'
            );
          }
          const capSMS = SMS_HABILITADO ? getConfig('captura_sms') : null;
          const capNotif = getConfig('captura_notif');
          if (capSMS === 'true') {
            iniciarEscuchaSMS();
            importarHistorialSMS().catch(console.warn);
          }
          if (capNotif === 'true') {
            iniciarEscuchaNotificaciones();
          }
          programarRecordatorioDiario().catch(console.warn);
          programarReporteSemanal().catch(console.warn);
          initReminderChannel().catch(console.warn);
        }
      } catch (e) {
        console.error('Error al inicializar app:', e);
        setEstado('onboarding');
      }
    }
    arrancar();
  }, []);

  // Mark app as ready once fonts + initial state are resolved
  useEffect(() => {
    if (fontsLoaded && estado !== 'loading') {
      setAppReady(true);
    }
  }, [fontsLoaded, estado]);

  // When BOTH app is ready AND splash animation finished → fade out JS layer, then reveal the Stack
  useEffect(() => {
    if (appReady && splashAnimDone) {
      Animated.timing(splashOpacity, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
      }).start(() => {
        setSplashDone(true);
      });
    }
  }, [appReady, splashAnimDone]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next !== 'active') return;
      if (!consumirSalidaSolicitada()) return;
      splashOpacity.setValue(1);
      setSplashAnimDone(false);
      setSplashDone(false);
    });
    return () => subscription.remove();
  }, [splashOpacity]);

  useEffect(() => {
    if (estado !== 'app') return;
    let sub: { remove: () => void } | null = null;
    (async () => {
      try {
        const Notifications = await import('expo-notifications');
        sub = Notifications.addNotificationResponseReceivedListener(res => {
          const data = res.notification.request.content.data;
          if (data?.screen === 'notificaciones') {
            router.push('/notificaciones' as any);
          }
        });
      } catch { console.warn('[_layout] Error registrando listener notificaciones'); }
    })();
    return () => sub?.remove();
  }, [estado]);

  if (!splashDone) {
    return (
      <Animated.View
        style={{ flex: 1, opacity: splashOpacity, backgroundColor: splashBg }}
        onLayout={ocultarSplashNativo}
      >
        <SplashLogo onReady={() => setSplashAnimDone(true)} />
      </Animated.View>
    );
  }

  async function aplicarUpdate() {
    setUpdateBanner(false);
    await Updates.fetchUpdateAsync();
    await Updates.reloadAsync();
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {updateBanner && (
        <View style={{ backgroundColor: '#B36A2A', paddingVertical: 8, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: '#FAF8F4', fontSize: 13, fontWeight: '500' }}>Nueva versión disponible</Text>
          <TouchableOpacity onPress={aplicarUpdate} style={{ backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 14, paddingVertical: 5, borderRadius: 6 }}>
            <Text style={{ color: '#FAF8F4', fontSize: 12, fontWeight: '600' }}>Actualizar</Text>
          </TouchableOpacity>
        </View>
      )}
      <ErrorBoundary>
      <SafeAreaProvider>
        <ThemeProvider>
          <StatusBarWrapper />
          <FloatingNotificationProvider>
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
            <Stack.Screen
              name="presupuestos"
              options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
            />
            <Stack.Screen
              name="duplicados"
              options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
            />
            <Stack.Screen
              name="recordatorios"
              options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
            />
            <Stack.Screen
              name="notificaciones"
              options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="banco/[id]"
              options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="privacidad"
              options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="celebracion"
              options={{ presentation: 'modal', animation: 'fade' }}
            />
            <Stack.Screen
              name="meta/nueva"
              options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
            />
            <Stack.Screen
              name="comprobante"
              options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
            />
          </Stack>
          </FloatingNotificationProvider>
          {estado === 'app' && <DeepLinkCaptura />}
          {estado === 'onboarding' && <Redirect href="/onboarding/bienvenida" />}
        </ThemeProvider>
      </SafeAreaProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
