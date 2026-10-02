/**
 * FloatingNotification
 * Responsabilidad: Context + componente de notificacion toast flotante
 * Usado por: app/_layout.tsx (proveedor global)
 * Depende de: ThemeContext
 */
import { useRef, useEffect, useCallback, createContext, useContext, useState } from 'react';
import {
  View, Text, Animated, StyleSheet, TouchableOpacity, Dimensions,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeCtx } from '@/services/ThemeContext';
import { colors, colorsDark, fonts, shadows } from '@/theme/design-system';

type TipoNotificacion = 'success' | 'error' | 'info' | 'warning';

interface Notificacion {
  id: string;
  mensaje: string;
  tipo: TipoNotificacion;
  duracion: number;
}

interface Contexto {
  mostrar: (mensaje: string, tipo?: TipoNotificacion, duracion?: number) => void;
  ocultar: () => void;
}

const Ctx = createContext<Contexto>({ mostrar: () => {}, ocultar: () => {} });
export const useNotificacion = () => useContext(Ctx);

function getTinte(tipo: TipoNotificacion, t: typeof colors): string {
  return { success: t.positive, error: t.negative, info: t.accent, warning: t.warn }[tipo];
}

const ICONOS: Record<TipoNotificacion, (c: string) => React.ReactNode> = {
  success: (c: string) => (
    <Circle cx="12" cy="12" r="10" fill="none" stroke={c} strokeWidth={2} />
  ),
  error: (c: string) => (
    <Path d="M18 6L6 18M6 6l12 12" stroke={c} strokeWidth={2} strokeLinecap="round" />
  ),
  info: (c: string) => (
    <>
      <Circle cx="12" cy="12" r="10" fill="none" stroke={c} strokeWidth={2} />
      <Path d="M12 16v-4M12 8h.01" stroke={c} strokeWidth={2} strokeLinecap="round" />
    </>
  ),
  warning: (c: string) => (
    <Path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  ),
};

function useStyles(t: typeof colors) {
  return StyleSheet.create({
    contenedor: {
      position: 'absolute',
      left: 16,
      right: 16,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: t.card,
      borderRadius: 14,
      paddingVertical: 14,
      paddingLeft: 0,
      paddingRight: 14,
      zIndex: 9999,
      borderWidth: 1,
      borderColor: t.hairline,
      ...shadows.fab,
    },
    barra: {
      width: 4,
      height: '100%',
      borderTopLeftRadius: 14,
      borderBottomLeftRadius: 14,
      marginRight: 12,
    },
    icono: {
      width: 32,
      height: 32,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },
    texto: {
      flex: 1,
      fontSize: 13.5,
      fontFamily: fonts.ui,
      fontWeight: '500',
      color: t.ink,
      lineHeight: 19,
    },
    cerrar: {
      fontSize: 14,
      color: t.muteText,
      marginLeft: 10,
    },
  });
}

export function FloatingNotificationProvider({ children }: { children: React.ReactNode }) {
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;
  const styles = useStyles(t);
  const [notif, setNotif] = useState<Notificacion | null>(null);
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const insets = useSafeAreaInsets();

  const ocultar = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: -120, duration: 250, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setNotif(null));
  }, []);

  const mostrar = useCallback((mensaje: string, tipo: TipoNotificacion = 'info', duracion = 3000) => {
    if (timer.current) clearTimeout(timer.current);
    setNotif({ id: Date.now().toString(), mensaje, tipo, duracion });
    translateY.setValue(-120);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, friction: 10, tension: 80 }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    timer.current = setTimeout(ocultar, duracion);
  }, [ocultar]);

  if (!notif) {
    return (
      <Ctx.Provider value={{ mostrar, ocultar }}>
        {children}
      </Ctx.Provider>
    );
  }

  const tinte = getTinte(notif.tipo, t);

  return (
    <Ctx.Provider value={{ mostrar, ocultar }}>
      {children}
      <Animated.View
        style={[
          styles.contenedor,
          { top: insets.top + 8, transform: [{ translateY }], opacity },
        ]}
      >
        <View style={[styles.barra, { backgroundColor: tinte }]} />
        <View style={styles.icono}>
          <Svg width={20} height={20} viewBox="0 0 24 24">
            {ICONOS[notif.tipo](tinte)}
          </Svg>
        </View>
        <Text style={styles.texto} numberOfLines={2}>{notif.mensaje}</Text>
        <TouchableOpacity onPress={ocultar} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Svg width={16} height={16} viewBox="0 0 16 16">
            <Path d="M4 4l8 8M12 4l-8 8" fill="none" stroke={tinte} strokeWidth={1.8} strokeLinecap="round" />
          </Svg>
        </TouchableOpacity>
      </Animated.View>
    </Ctx.Provider>
  );
}
