// app/onboarding/permisos.tsx — Paso 3: Permisos del sistema
import { View, Text, TouchableOpacity, StyleSheet, Platform, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { setOnboardingCompletado } from '@/services/database';

const C = {
  bg:     '#FAF8F4',
  ink:    '#181513',
  copper: '#B36A2A',
  muted:  '#9B8E84',
};

const PERMISOS = [
  {
    id: 'sms',
    icono: '💬',
    titulo: 'Lectura de SMS',
    desc: 'Captura automática de SMS bancarios para registrar tus movimientos al instante.',
    obligatorio: false,
    tag: 'READ_SMS / RECEIVE_SMS',
  },
  {
    id: 'notif',
    icono: '🔔',
    titulo: 'Notificaciones',
    desc: 'Captura de notificaciones push de las apps bancarias que seleccionaste.',
    obligatorio: false,
    tag: 'BIND_NOTIFICATION_LISTENER_SERVICE',
  },
  {
    id: 'internet',
    icono: '🤖',
    titulo: 'Internet (Asesor IA)',
    desc: 'Solo para conectarse con el chatbot IA cuando lo usés. No se envían datos bancarios.',
    obligatorio: false,
    tag: 'INTERNET',
  },
];

export default function PermisosScreen() {
  const router = useRouter();

  async function finalizar() {
    await setOnboardingCompletado({
      completado: true,
      bancosSeleccionados: [],  // Ya se guardaron en el paso anterior
      permisoSMS: false,        // Se actualizan cuando el usuario concede en Android
      permisoNotif: false,
    });
    router.replace('/(tabs)');
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={s.contenedor}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={{ color: C.copper, fontSize: 16 }}>← Atrás</Text>
          </TouchableOpacity>
          <View style={s.progreso}>
            <View style={[s.paso, { backgroundColor: C.copper }]} />
            <View style={[s.paso, { backgroundColor: C.copper }]} />
            <View style={[s.paso, { backgroundColor: C.copper }]} />
          </View>
        </View>

        {/* Contenido */}
        <View style={{ flex: 1, padding: 24 }}>
          <Text style={s.titulo}>Permisos opcionales</Text>
          <Text style={s.subtitulo}>
            Estos permisos son opcionales. Si los denegás, la app funciona igual
            pero solo con entrada manual. Podés activarlos después en Configuración.
          </Text>

          <View style={s.lista}>
            {PERMISOS.map(p => (
              <View key={p.id} style={s.permisoItem}>
                <Text style={s.permisoIcono}>{p.icono}</Text>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <Text style={s.permisoTitulo}>{p.titulo}</Text>
                  </View>
                  <Text style={s.permisoDesc}>{p.desc}</Text>
                  <Text style={s.permisoTag}>{p.tag}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={s.nota}>
            <Text style={s.notaTexto}>
              ℹ️ Para SMS y notificaciones, Android mostrará su diálogo de permisos nativo.
              Para notificaciones de apps bancarias, necesitás activar el acceso en{' '}
              <Text style={{ color: C.copper, fontWeight: '600' }}>
                Ajustes → Acceso a notificaciones
              </Text>.
            </Text>
          </View>
        </View>

        {/* Footer */}
        <View style={s.footer}>
          <TouchableOpacity
            style={s.boton}
            onPress={finalizar}
            activeOpacity={0.85}
          >
            <Text style={s.botonTexto}>Ir al panel →</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 12, color: C.muted, textAlign: 'center', marginTop: 8 }}>
            Los permisos se pueden configurar después en Ajustes.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  contenedor: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingBottom: 8,
  },
  progreso: { flexDirection: 'row', gap: 6 },
  paso: {
    width: 24, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(24,21,19,0.12)',
  },
  titulo:    { fontSize: 22, fontWeight: '700', color: '#181513', letterSpacing: -0.3, marginBottom: 8 },
  subtitulo: { fontSize: 13.5, color: '#9B8E84', lineHeight: 20, marginBottom: 24 },
  lista:     { gap: 12 },
  permisoItem: {
    flexDirection: 'row',
    gap: 14,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(24,21,19,0.07)',
  },
  permisoIcono: { fontSize: 24, width: 30, textAlign: 'center' },
  permisoTitulo:{ fontSize: 14.5, fontWeight: '600', color: '#181513' },
  permisoDesc:  { fontSize: 12.5, color: '#9B8E84', lineHeight: 18, marginTop: 2 },
  permisoTag: {
    fontSize: 10, color: '#B36A2A', fontFamily: 'GeistMono',
    marginTop: 4, letterSpacing: 0.3,
  },
  nota: {
    marginTop: 20,
    padding: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(179,106,42,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(179,106,42,0.2)',
  },
  notaTexto: { fontSize: 12.5, color: '#6B5F55', lineHeight: 18 },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(24,21,19,0.07)',
  },
  boton: {
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: '#B36A2A',
    alignItems: 'center',
  },
  botonTexto: { fontSize: 15.5, fontWeight: '700', color: '#FAF8F4' },
});
