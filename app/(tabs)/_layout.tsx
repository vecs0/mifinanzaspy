/**
 * (tabs)/_layout.tsx
 * Responsabilidad: Tab bar principal con íconos SVG
 * Usado por: expo-router (tabs layout root)
 * Depende de: ThemeContext
 */
import { useEffect, useState, useRef } from 'react';
import { Tabs, router, useNavigation } from 'expo-router';
import { View, Text, TouchableOpacity, BackHandler, StyleSheet, Modal, Animated, AppState, type AppStateStatus } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useThemeCtx } from '@/services/ThemeContext';
import { resolverBack, type EstadoBack } from '@/services/navegacionBack';
import { marcarSalidaSolicitada } from '@/services/salidaApp';
import { colors, colorsDark, borderRadius as br } from '@/theme/design-system';

const TAB_PATHS = ['/', '/historial', '/reportes', '/crecer', '/chat'] as const;
const TABS_ROUTE = '(tabs)';
const ONBOARDING_ROUTE = 'onboarding';

type RutaNav = {
  name: string;
  state?: { index?: number; routes?: readonly { name: string }[] };
};

type EstadoNav = { index?: number; routes?: readonly RutaNav[] } | undefined;

function indiceTab(state: EstadoNav): number {
  const tabs = state?.routes?.find(r => r.name === TABS_ROUTE);
  return tabs?.state?.index ?? 0;
}

function estadoBack(state: EstadoNav, dialogoSalidaVisible: boolean): EstadoBack {
  const routes = state?.routes ?? [];
  const enfocada = routes[state?.index ?? 0];
  return {
    capaActiva: enfocada && enfocada.name !== TABS_ROUTE ? 'pantalla-apilada' : 'ninguna',
    indexTab: indiceTab(state),
    tabsDebajo: routes.some(r => r.name === TABS_ROUTE),
    onboardingEnCurso: enfocada?.name === ONBOARDING_ROUTE,
    dialogoSalidaVisible,
  };
}

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;
  const scale = useRef(new Animated.Value(1)).current;
  const color  = focused ? t.accent : t.ink3;
  const stroke = { stroke: color, strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };

  useEffect(() => {
    Animated.spring(scale, {
      toValue: focused ? 1.35 : 1,
      friction: 5,
      tension: 140,
      useNativeDriver: true,
    }).start();
  }, [focused]);

  const icons: Record<string, React.ReactNode> = {
    'home-nav': <Path d="M3 11l9-7 9 7v9h-6v-6h-6v6H3z" {...stroke} />,
    'list':     <>
                  <Path d="M4 6h16M4 12h16M4 18h16" {...stroke} />
                  <Circle cx="4" cy="6" r={0.6} fill={color} stroke="none" />
                  <Circle cx="4" cy="12" r={0.6} fill={color} stroke="none" />
                  <Circle cx="4" cy="18" r={0.6} fill={color} stroke="none" />
                </>,
    'pie':      <>
                  <Path d="M12 3v9h9a9 9 0 11-9-9z" {...stroke} />
                  <Path d="M14 3a7 7 0 017 7h-7V3z" {...stroke} />
                </>,
    'crecer':   <>
                  <Path d="M12 22V12" {...stroke} />
                  <Path d="M12 12C12 7 7 4 3 6c2 3 5 5 9 6z" {...stroke} />
                  <Path d="M12 12C12 7 17 4 21 6c-2 3-5 5-9 6z" {...stroke} />
                  <Path d="M12 16C12 13 9 11 6 12c1 2 3 3 6 4z" {...stroke} />
                </>,
    'chat':     <Path d="M4 5h16v11h-7l-5 4v-4H4z" {...stroke} />,
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={22} height={22} viewBox="0 0 24 24">
          {icons[name]}
        </Svg>
      </View>
    </Animated.View>
  );
}

function TabLabel({ label, focused }: { label: string; focused: boolean }) {
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;
  const opacity = useRef(new Animated.Value(focused ? 1 : 0.6)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: focused ? 1 : 0.6,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [focused]);

  return (
    <Animated.Text
      style={{
        fontFamily: 'Geist',
        fontSize: 11,
        letterSpacing: 0.2,
        marginTop: 2,
        color: focused ? t.accent : t.ink3,
        fontWeight: focused ? '700' : '500',
        opacity,
      }}
    >
      {label}
    </Animated.Text>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { dark } = useThemeCtx();
  const [mostrarSalir, setMostrarSalir] = useState(false);
  const navigation = useNavigation();

  const t = dark ? colorsDark : colors;

  useEffect(() => {
    const onBack = () => {
      const state = navigation.getState();
      if (!state) return false;
      const estado = estadoBack(state as unknown as EstadoNav, mostrarSalir);
      const accion = resolverBack(estado);
      if (accion === 'ir-a-panel') {
        router.navigate('/' as any);
        return true;
      }
      if (accion === 'mostrar-dialogo-salida') {
        setMostrarSalir(true);
        return true;
      }
      return false;
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => subscription.remove();
  }, [navigation, mostrarSalir]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (estado: AppStateStatus) => {
      if (estado === 'background' || estado === 'inactive') setMostrarSalir(false);
    });
    return () => subscription.remove();
  }, []);

  const salirDeLaApp = () => {
    setMostrarSalir(false);
    marcarSalidaSolicitada();
    requestAnimationFrame(() => BackHandler.exitApp());
  };

  const swipe = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-22, 22])
    .failOffsetY([-14, 14])
    .onEnd((e) => {
      const idx = indiceTab(navigation.getState() as unknown as EstadoNav);
      if (e.translationX < -50 && idx < TAB_PATHS.length - 1) {
        router.navigate(TAB_PATHS[idx + 1] as any);
      } else if (e.translationX > 50 && idx > 0) {
        router.navigate(TAB_PATHS[idx - 1] as any);
      }
    });

  return (
    <GestureDetector gesture={swipe}>
    <View style={{ flex: 1 }}>
      <Tabs
        backBehavior="firstRoute"
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: t.bg,
            borderTopColor: t.hairline,
            borderTopWidth: StyleSheet.hairlineWidth,
            paddingBottom: Math.max(insets.bottom, 8),
            paddingTop: 8,
            height: 60 + Math.max(insets.bottom, 8),
          },
          tabBarActiveTintColor:   t.accent,
          tabBarInactiveTintColor: t.ink3,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            tabBarLabel: ({ focused }) => <TabLabel label="Panel" focused={focused} />,
            tabBarIcon: ({ focused }) => <TabIcon name="home-nav" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="historial"
          options={{
            tabBarLabel: ({ focused }) => <TabLabel label="Historial" focused={focused} />,
            tabBarIcon: ({ focused }) => <TabIcon name="list" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="reportes"
          options={{
            tabBarLabel: ({ focused }) => <TabLabel label="Reportes" focused={focused} />,
            tabBarIcon: ({ focused }) => <TabIcon name="pie" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="crecer"
          options={{
            tabBarLabel: ({ focused }) => <TabLabel label="Crecé" focused={focused} />,
            tabBarIcon: ({ focused }) => <TabIcon name="crecer" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="chat"
          options={{
            tabBarLabel: ({ focused }) => <TabLabel label="Asesor IA" focused={focused} />,
            tabBarIcon: ({ focused }) => <TabIcon name="chat" focused={focused} />,
          }}
        />
      </Tabs>

      <Modal visible={mostrarSalir} transparent animationType="fade" onRequestClose={() => setMostrarSalir(false)}>
        <View style={{ flex: 1, backgroundColor: t.scrim, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <View style={{ backgroundColor: t.card, borderRadius: br.xl, padding: 24, width: '100%', maxWidth: 300, borderWidth: 1, borderColor: t.hairline, gap: 16 }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.accentBg, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' }}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                <Path d="M16 17l5-5-5-5" />
                <Path d="M21 12H9" />
              </Svg>
            </View>
            <Text style={{ fontSize: 16, fontWeight: '700', color: t.ink, textAlign: 'center' }}>Salir de la app</Text>
            <Text style={{ fontSize: 13, color: t.ink2, textAlign: 'center', lineHeight: 18 }}>
              ¿Estás seguro de que querés salir?
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                style={{ flex: 1, minHeight: 48, justifyContent: 'center', borderRadius: br.md, backgroundColor: t.accent, alignItems: 'center' }}
                onPress={salirDeLaApp}
              >
                <Text style={{ color: t.onAccent, fontSize: 14, fontWeight: '600' }}>Salir</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, minHeight: 48, justifyContent: 'center', borderRadius: br.md, backgroundColor: t.hairline, alignItems: 'center' }}
                onPress={() => setMostrarSalir(false)}
              >
                <Text style={{ color: t.ink, fontSize: 14, fontWeight: '500' }}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
    </GestureDetector>
  );
}
