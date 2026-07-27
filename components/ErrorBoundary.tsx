/**
 * ErrorBoundary
 * Responsabilidad: Error boundary global con boton de reinicio
 * Usado por: app/_layout.tsx
 * Depende de: ThemeContext
 */
import { Component, type ReactNode, type ErrorInfo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useThemeCtx } from '@/services/ThemeContext';
import { colors, colorsDark } from '@/theme/design-system';

type ThemeColors = typeof colors;

interface ClassProps {
  children: ReactNode;
  theme: ThemeColors;
}

interface ClassState {
  error: Error | null;
}

class ErrorBoundaryClass extends Component<ClassProps, ClassState> {
  state: ClassState = { error: null };

  static getDerivedStateFromError(error: Error): ClassState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    const t = this.props.theme;
    if (this.state.error) {
      return (
        <View style={[styles.container, { backgroundColor: t.bg }]}>
          <Text style={[styles.icon, { color: t.accent, backgroundColor: t.accent + '1A' }]}>!</Text>
          <Text style={[styles.titulo, { color: t.ink }]}>Algo salio mal</Text>
          <Text style={[styles.subtitulo, { color: t.ink2 }]}>
            Ocurrio un error inesperado. Toca el boton para reiniciar la app.
          </Text>
          <TouchableOpacity
            style={[styles.boton, { backgroundColor: t.ink }]}
            onPress={() => this.setState({ error: null })}
            activeOpacity={0.85}
          >
            <Text style={[styles.botonTexto, { color: t.bg }]}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function ErrorBoundary({ children }: { children: ReactNode }) {
  const { dark } = useThemeCtx();
  const theme = dark ? colorsDark : colors;
  return <ErrorBoundaryClass theme={theme}>{children}</ErrorBoundaryClass>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  icon: {
    fontSize: 48,
    fontWeight: '700',
    marginBottom: 16,
    width: 72,
    height: 72,
    lineHeight: 72,
    textAlign: 'center',
    borderRadius: 36,
    overflow: 'hidden',
  },
  titulo: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitulo: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  boton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
  },
  botonTexto: {
    fontSize: 15,
    fontWeight: '600',
  },
});
