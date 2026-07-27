/**
 * +not-found.tsx
 * Responsabilidad: Pantalla 404 para rutas inexistentes
 * Usado por: expo-router (auto)
 * Depende de: ninguno
 */
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Link } from 'expo-router';

export default function NotFoundScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>404</Text>
      <Text style={styles.subtitle}>Pantalla no encontrada</Text>
      <Link href="/" asChild>
        <TouchableOpacity style={styles.button}>
          <Text style={styles.buttonText}>Volver al inicio</Text>
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
    backgroundColor: '#FAF8F4',
    padding: 24,
  },
  title: {
    fontSize: 64,
    fontWeight: '700',
    color: '#B36A2A',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#6B5F55',
    marginBottom: 32,
  },
  button: {
    backgroundColor: '#B36A2A',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  buttonText: {
    color: '#FAF8F4',
    fontSize: 16,
    fontWeight: '600',
  },
});
