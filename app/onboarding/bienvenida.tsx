// app/onboarding/bienvenida.tsx — Paso 1: Bienvenida
// Diseño: "Tu plata, clara." en Newsreader italic · 3 features con íconos · CTA ink
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Path, Rect, Circle } from 'react-native-svg';

const C = {
  bg:     '#FAF8F4',
  ink:    '#181513',
  accent: '#B36A2A',
  muted:  'rgba(24,21,19,0.5)',
  ink2:   'rgba(24,21,19,0.6)',
};

// ─── App Icon ₲ ─────────────────────────────────────────────────
function AppIcon({ size = 72 }: { size?: number }) {
  const r = size * 0.22;
  return (
    <View style={{
      width: size, height: size, borderRadius: size * 0.26,
      backgroundColor: C.accent,
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ color: '#FAF8F4', fontSize: size * 0.46, fontWeight: '700', lineHeight: size * 0.55 }}>
        ₲
      </Text>
    </View>
  );
}

// ─── SVG inline icons (igual que en common.jsx del prototipo) ────
function SvgIcon({ name, size = 18, color = C.accent }: { name: string; size?: number; color?: string }) {
  const stroke = { stroke: color, strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  const paths: Record<string, React.ReactNode> = {
    sms:   <><Rect x="3" y="5" width="18" height="13" rx="2" {...stroke}/><Path d="M3 7l9 6 9-6" {...stroke}/></>,
    notif: <Path d="M7 17V11a5 5 0 0110 0v6h2v2H5v-2zM10 19h4" {...stroke}/>,
    lock:  <><Rect x="5" y="11" width="14" height="9" rx="2" {...stroke}/><Path d="M8 11V8a4 4 0 018 0v3" {...stroke}/></>,
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {paths[name]}
    </Svg>
  );
}

const FEATURES = [
  { key: 'sms',   label: 'Lectura automática de SMS bancarios' },
  { key: 'notif', label: 'Captura de notificaciones de apps' },
  { key: 'lock',  label: 'Todo se guarda en tu teléfono' },
];

export default function BienvenidaScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={s.contenedor}>

        {/* Paso / logo */}
        <View style={s.topRow}>
          <Text style={s.pasoLabel}>01 — Bienvenida</Text>
          <Text style={s.pasoNum}>1 / 3</Text>
        </View>

        {/* Hero */}
        <View style={s.hero}>
          <AppIcon size={64} />
          <Text style={s.heading}>Tu plata,{'\n'}clara.</Text>
          <Text style={s.subtitulo}>
            Centralizamos los movimientos de tus bancos y billeteras paraguayas,
            te avisamos a tiempo y respondemos cuando preguntás.
          </Text>
        </View>

        {/* Features */}
        <View style={s.features}>
          {FEATURES.map(f => (
            <View key={f.key} style={s.featureRow}>
              <View style={s.featureIcon}>
                <SvgIcon name={f.key} size={17} color={C.accent} />
              </View>
              <Text style={s.featureLabel}>{f.label}</Text>
            </View>
          ))}
        </View>

        {/* CTA */}
        <View style={s.footer}>
          <TouchableOpacity
            style={s.boton}
            onPress={() => router.push('/onboarding/bancos')}
            activeOpacity={0.85}
          >
            <Text style={s.botonTexto}>Empezar</Text>
            <Text style={[s.botonTexto, { fontWeight: '400' }]}> →</Text>
          </TouchableOpacity>
          <Text style={s.legal}>Sin servidor. Sin cuenta. Solo este teléfono.</Text>
        </View>

      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  contenedor: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 20,
    paddingBottom: 24,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 40,
  },
  pasoLabel: {
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: C.muted,
  },
  pasoNum: { fontSize: 11, color: C.muted },
  hero: { marginBottom: 40 },
  heading: {
    fontFamily: 'Newsreader-Italic',
    fontStyle: 'italic',
    fontWeight: '400',
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -1,
    color: C.ink,
    marginTop: 24,
    marginBottom: 12,
  },
  subtitulo: {
    fontSize: 15,
    lineHeight: 23,
    color: C.ink2,
    maxWidth: 300,
  },
  features: { gap: 14, marginBottom: 'auto' as any, flex: 1, justifyContent: 'flex-start' },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  featureIcon: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: 'rgba(24,21,19,0.04)',
    alignItems: 'center', justifyContent: 'center',
  },
  featureLabel: { fontSize: 14, color: 'rgba(24,21,19,0.78)' },
  footer: { gap: 10, alignItems: 'center', marginTop: 20 },
  boton: {
    width: '100%',
    height: 52,
    borderRadius: 14,
    // CTA ink — igual al prototipo: '#181513'
    backgroundColor: C.ink,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  botonTexto: { fontSize: 15, fontWeight: '600', color: '#FAF8F4', letterSpacing: 0.1 },
  legal: { fontSize: 11, color: C.muted, textAlign: 'center' },
});
