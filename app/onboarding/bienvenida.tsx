/**
 * onboarding/bienvenida.tsx
 * Responsabilidad: Paso 1 de onboarding — Bienvenida
 * Usado por: expo-router (onboarding flow)
 * Depende de: ninguno
 */
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { useThemeCtx } from '@/services/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import { colors, colorsDark, fonts } from '@/theme/design-system';


function AppIcon({ size = 72 }: { size?: number }) {
  return (
    <Image
      source={require('@/assets/icon.png')}
      style={{ width: size, height: size, borderRadius: size * 0.26 }}
      resizeMode="cover"
    />
  );
}

function SvgIcon({ name, size = 18, color }: { name: string; size?: number; color?: string }) {
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;
  const c = color ?? t.accent;
  const stroke = { stroke: c, strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
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
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;
  const s = useStyles(t);
  const router = useRouter();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={s.contenedor}>

        {/* Paso / logo */}
        <View style={s.topRow}>
          <Text style={s.pasoLabel}>01 — Bienvenida</Text>
          <Text style={s.pasoNum}>1 / 5</Text>
        </View>

        {/* Hero */}
        <View style={s.hero}>
          <AppIcon size={64} />
          <Text style={s.heading}>Sabés lo{'\n'}que tenés.</Text>
          <Text style={s.subtitulo}>
            Centralizamos los movimientos de tus bancos y billeteras paraguayas,
            te avisamos a tiempo y respondemos cuando preguntás.
          </Text>
          <Text style={s.estimado}>5 pasos · menos de 2 minutos</Text>
        </View>

        {/* Features */}
        <View style={s.features}>
          {FEATURES.map(f => (
            <View key={f.key} style={s.featureRow}>
              <View style={s.featureIcon}>
                <SvgIcon name={f.key} size={17} color={t.accent} />
              </View>
              <Text style={s.featureLabel}>{f.label}</Text>
            </View>
          ))}
        </View>

        {/* CTA */}
        <View style={s.footer}>
          <TouchableOpacity
            style={s.boton}
            onPress={() => router.push('/onboarding/perfil' as any)}
            activeOpacity={0.85}
          >
            <Text style={s.botonTexto}>Empezar</Text>
            <Text style={[s.botonTexto, { fontWeight: '400' }]}> →</Text>
          </TouchableOpacity>
          
        </View>

      </View>
    </SafeAreaView>
  );
}

function useStyles(t: typeof colors) {
  return StyleSheet.create({
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
      color: t.muted,
      fontFamily: fonts.ui,
    },
    pasoNum: { fontSize: 11, color: t.muted, fontFamily: fonts.mono },
    hero: { marginBottom: 40 },
    heading: {
      fontFamily: 'Newsreader-Italic',
      fontStyle: 'italic',
      fontWeight: '400',
      fontSize: 40,
      lineHeight: 44,
      letterSpacing: -1,
      color: t.ink,
      marginTop: 24,
      marginBottom: 12,
    },
    subtitulo: {
      fontSize: 15,
      lineHeight: 23,
      color: t.ink2,
      maxWidth: 300,
      fontFamily: fonts.ui,
    },
    features: { gap: 14, flex: 1, justifyContent: 'flex-start' },
    featureRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    featureIcon: {
      width: 32, height: 32, borderRadius: 10,
      backgroundColor: t.surface,
      alignItems: 'center', justifyContent: 'center',
    },
    featureLabel: { fontSize: 14, color: t.ink2, fontFamily: fonts.ui },
    footer: { gap: 10, alignItems: 'center', marginTop: 20 },
    boton: {
      width: '100%',
      height: 52,
      borderRadius: 14,
      backgroundColor: t.ink,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    botonTexto: { fontSize: 15, fontWeight: '600', color: t.bg, fontFamily: fonts.ui, letterSpacing: 0.1 },
    estimado: { fontSize: 11, color: t.muted, fontFamily: fonts.ui, marginTop: 8 },
    legal: { fontSize: 11, color: t.muted, textAlign: 'center' },
  });
}
