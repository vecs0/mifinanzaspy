/**
 * +not-found.tsx
 * Responsabilidad: Pantalla 404 para rutas inexistentes
 * Usado por: expo-router (auto)
 * Depende de: ThemeContext, design-system
 */
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Link } from 'expo-router';
import { useThemeCtx } from '@/services/ThemeContext';
import { colors, colorsDark, borderRadius as br } from '@/theme/design-system';

export default function NotFoundScreen() {
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;
  return (
    <View style={[styles.container, { backgroundColor: t.bg }]}>
      <Text style={[styles.title, { color: t.accent }]} accessibilityRole="header">404</Text>
      <Text style={[styles.subtitle, { color: t.ink2 }]}>No encontramos esta pantalla</Text>
      <Link href="/" asChild>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: t.accent }]}
          accessibilityRole="button"
          accessibilityLabel="Volver al inicio"
        >
          <Text style={[styles.buttonText, { color: t.onAccent }]}>Volver al inicio</Text>
        </TouchableOpacity>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 64,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    marginBottom: 32,
  },
  button: {
    minHeight: 48,
    paddingHorizontal: 24,
    justifyContent: 'center',
    borderRadius: br.md,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
