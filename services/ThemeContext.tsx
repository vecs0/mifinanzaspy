/**
 * ThemeContext
 * Responsabilidad: Contexto de tema (claro/oscuro/sistema)
 * Usado por: ~40 screens y componentes
 * Depende de: database, design-system
 */
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { getConfig, setConfig } from '@/services/database';
import { colors, colorsDark, type Theme } from '@/theme/design-system';

export type ModoOscuro = 'light' | 'dark' | 'system';

interface ThemeCtx {
  dark: boolean;
  theme: Theme;
  mode: ModoOscuro;
  setModo: (m: ModoOscuro) => void;
}

export const ThemeContext = createContext<ThemeCtx>({ dark: false, theme: colors, mode: 'system', setModo: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [mode, setMode] = useState<ModoOscuro>('system');
  const [modoGuardado, setModoGuardado] = useState<ModoOscuro | null>(null);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    const val = getConfig('modo_oscuro');
    const m: ModoOscuro = val === 'true' ? 'dark' : val === 'false' ? 'light' : val === 'sistema' || val === 'system' ? 'system' : 'light';
    setMode(m);
    setModoGuardado(m);
    setListo(true);
  }, []);

  useEffect(() => {
    if (!modoGuardado) return;
    if (modoGuardado === 'system' && system) {
      setMode('system');
    }
  }, [system, modoGuardado]);

  const dark = mode === 'dark' || (mode === 'system' && system === 'dark');

  const setModo = useCallback((m: ModoOscuro) => {
    setMode(m);
    setModoGuardado(m);
    setConfig('modo_oscuro', m);
  }, []);

  return (
    <ThemeContext.Provider value={{ dark, theme: dark ? colorsDark : colors, mode: modoGuardado ?? 'system', setModo }}>
      {listo ? children : null}
    </ThemeContext.Provider>
  );
}

export function useThemeCtx() {
  return useContext(ThemeContext);
}
