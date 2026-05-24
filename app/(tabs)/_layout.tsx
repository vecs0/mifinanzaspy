// app/(tabs)/_layout.tsx — Tab bar principal con íconos SVG reales
import { Tabs } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';

const C = {
  bg:     '#FAF8F4',
  ink:    '#181513',
  accent: '#B36A2A',
  muted:  '#9B8E84',
  border: 'rgba(24,21,19,0.07)',
};

// ─── SVG icons — mismas paths que common.jsx del prototipo ───────
function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const color  = focused ? C.accent : C.muted;
  const stroke = { stroke: color, strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };

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
    'chat':     <Path d="M4 5h16v11h-7l-5 4v-4H4z" {...stroke} />,
  };

  return (
    <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={22} height={22} viewBox="0 0 24 24">
        {icons[name]}
      </Svg>
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: C.bg,
          borderTopColor: C.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          paddingBottom: insets.bottom + 4,
          paddingTop: 8,
          height: 56 + insets.bottom,
        },
        tabBarActiveTintColor:   C.accent,
        tabBarInactiveTintColor: C.muted,
        tabBarLabelStyle: {
          fontFamily: 'Geist',
          fontSize: 10.5,
          letterSpacing: 0.2,
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Panel',
          tabBarIcon: ({ focused }) => <TabIcon name="home-nav" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="historial"
        options={{
          title: 'Historial',
          tabBarIcon: ({ focused }) => <TabIcon name="list" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="reportes"
        options={{
          title: 'Reportes',
          tabBarIcon: ({ focused }) => <TabIcon name="pie" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Asesor IA',
          tabBarIcon: ({ focused }) => <TabIcon name="chat" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
