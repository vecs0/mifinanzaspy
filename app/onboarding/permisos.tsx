/**
 * onboarding/permisos.tsx
 * Responsabilidad: Paso final de onboarding — Solicitar permisos SMS/notificaciones
 * Usado por: expo-router (onboarding flow)
 * Depende de: database, smsService, notificationService
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform, AppState, Linking,
} from 'react-native';
import { useThemeCtx } from '@/services/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import {
  solicitarPermisosLecturaSMS, getPermisosLecturaSMS,
} from '@/services/smsService';
import {
  isAccesoNotificacionesHabilitado, abrirAjustesNotificaciones,
} from '@/services/notificationService';
import { setOnboardingCompletado, setConfig, getOnboarding } from '@/services/database';
import { colors, colorsDark, fonts, borderRadius as br } from '@/theme/design-system';


type EstadoPermiso = 'checking' | 'granted' | 'denied';

function EstadoBadge({ estado, checking }: { estado: EstadoPermiso; checking?: boolean }) {
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;
  const s = useStyles(t);
  const color = estado === 'granted' ? t.positive : t.negative;
  const label = estado === 'granted' ? 'Concedido' : 'Denegado';
  if (checking) return null;
  return (
    <View style={[s.badge, { backgroundColor: `${color}15` }]}>
      <Svg width={10} height={10} viewBox="0 0 24 24" fill={color}>
        {estado === 'granted'
          ? <Path d="M20 6L9 17l-5-5" stroke={color} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          : <Path d="M18 6L6 18M6 6l12 12" stroke={color} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        }
      </Svg>
      <Text style={[s.badgeLabel, { color }]}>{label}</Text>
    </View>
  );
}

function MessageIcon() {
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </Svg>
  );
}

function BellIcon() {
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <Path d="M13.73 21a2 2 0 01-3.46 0" />
    </Svg>
  );
}

function GlobeIcon() {
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="12" cy="12" r="10" />
      <Path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
    </Svg>
  );
}

export default function PermisosScreen() {
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;
  const s = useStyles(t);
  const router = useRouter();
  const esSettings = getOnboarding().completado;
  const [estados, setEstados] = useState<Record<string, EstadoPermiso>>({
    sms: 'checking',
    notif: 'checking',
    internet: 'granted',
  });
  const [cargando, setCargando] = useState<string | null>(null);

  const appState = useRef(AppState.currentState);

  const verificarEstado = useCallback(async () => {
    if (Platform.OS !== 'android') {
      setEstados({ sms: 'granted', notif: 'granted', internet: 'granted' });
      return;
    }
    try {
      const sms = await getPermisosLecturaSMS();
      setEstados(prev => ({ ...prev, sms: sms.leer && sms.recibir ? 'granted' : 'denied' }));
    } catch {
      setEstados(prev => ({ ...prev, sms: prev.sms === 'checking' ? 'checking' : 'denied' }));
    }
    try {
      const notif = await isAccesoNotificacionesHabilitado();
      setEstados(prev => ({ ...prev, notif: notif ? 'granted' : 'denied' }));
    } catch {
      setEstados(prev => ({ ...prev, notif: prev.notif === 'checking' ? 'checking' : 'denied' }));
    }
  }, []);

  useEffect(() => { verificarEstado(); }, [verificarEstado]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', next => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        verificarEstado();
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, [verificarEstado]);

  async function handlePermiso(id: string) {
    if (cargando) return;
    setCargando(id);

    try {
      if (id === 'sms') {
        const ok = await solicitarPermisosLecturaSMS();
        if (ok) {
          setEstados(prev => ({ ...prev, sms: 'granted' }));
        } else {
          setEstados(prev => ({ ...prev, sms: 'denied' }));
        }
      } else if (id === 'notif') {
        try {
          await abrirAjustesNotificaciones();
        } catch {
          await Linking.openSettings();
        }
        const notif = await isAccesoNotificacionesHabilitado();
        setEstados(prev => ({ ...prev, notif: notif ? 'granted' : 'denied' }));
      }
    } catch {
      if (id === 'sms') setEstados(prev => ({ ...prev, sms: 'denied' }));
    } finally {
      setCargando(null);
    }
  }

  async function finalizar() {
    await setOnboardingCompletado({
      completado: true,
      bancosSeleccionados: [],
      permisoSMS: estados.sms === 'granted',
      permisoNotif: estados.notif === 'granted',
    });
    if (estados.sms === 'granted') setConfig('captura_sms', 'true');
    if (estados.notif === 'granted') setConfig('captura_notif', 'true');
    router.replace('/(tabs)');
  }

  const todosChequeados = Object.values(estados).every(e => e !== 'checking');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={s.contenedor}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M19 12H5M12 19l-7-7 7-7" />
            </Svg>
            <Text style={{ color: t.accent, fontSize: 14, fontWeight: '500' }}>{esSettings ? 'Ajustes' : 'Atrás'}</Text>
          </TouchableOpacity>
          {!esSettings && (
            <View style={s.progreso}>
              {[1,2,3,4,5].map(i => (
                <View key={i} style={[s.paso, { backgroundColor: i <= 4 ? t.accent : t.hairline }]} />
              ))}
            </View>
          )}
        </View>

        <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={s.titulo}>Conectá tus datos</Text>
          <Text style={s.subtitulo}>
            {esSettings
              ? 'Gestioná los permisos de la app para funcionalidades avanzadas como captura automática.'
              : 'Estos permisos aceleran el registro automático. Sin ellos podés ingresar todo manualmente desde Configuración.'
            }
          </Text>

          <View style={s.lista}>
            <View style={s.permisoItem}>
              <View style={s.iconWrap}><MessageIcon /></View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={s.permisoTitulo}>Lectura de SMS</Text>
                  <EstadoBadge estado={estados.sms} checking={estados.sms === 'checking'} />
                </View>
                <Text style={s.permisoDesc}>Capturá automáticamente los SMS bancarios para registrar tus movimientos al instante.</Text>
                {(estados.sms === 'denied') && (
                  <TouchableOpacity style={s.accionBtn} onPress={() => handlePermiso('sms')} disabled={cargando === 'sms'} activeOpacity={0.7}>
                    <Text style={s.accionBtnText}>{cargando === 'sms' ? 'Solicitando…' : 'Conceder permiso'}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View style={s.permisoItem}>
              <View style={s.iconWrap}><BellIcon /></View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={s.permisoTitulo}>Notificaciones</Text>
                  <EstadoBadge estado={estados.notif} checking={estados.notif === 'checking'} />
                </View>
                <Text style={s.permisoDesc}>Recibí notificaciones push de tus apps bancarias para registrar pagos y cobros al toque.</Text>
                {(estados.notif === 'denied') && (
                  <TouchableOpacity style={s.accionBtn} onPress={() => handlePermiso('notif')} disabled={cargando === 'notif'} activeOpacity={0.7}>
                    <Text style={s.accionBtnText}>{cargando === 'notif' ? 'Abriendo ajustes…' : 'Ir a ajustes'}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View style={[s.permisoItem, { opacity: 0.7 }]}>
              <View style={s.iconWrap}><GlobeIcon /></View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={s.permisoTitulo}>Internet</Text>
                  <EstadoBadge estado={estados.internet} />
                </View>
                <Text style={s.permisoDesc}>Conexión básica para el Asesor IA cuando lo usés. No se envían datos bancarios.</Text>
              </View>
            </View>
          </View>
        </ScrollView>

        <View style={s.footer}>
          {esSettings ? (
            <TouchableOpacity style={s.boton} onPress={() => router.back()} activeOpacity={0.85}>
              <Text style={s.botonTexto}>Listo</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                style={[s.boton, !todosChequeados && { opacity: 0.6 }]}
                onPress={finalizar}
                disabled={!todosChequeados}
                activeOpacity={0.85}
              >
                <Text style={s.botonTexto}>
                  {todosChequeados ? 'Ir al panel' : 'Verificando permisos…'}
                </Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 12, color: t.muted, textAlign: 'center', marginTop: 10 }}>
                Podés configurar estos permisos después en Ajustes.
              </Text>
            </>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

function useStyles(t: typeof colors) {
  return StyleSheet.create({
    contenedor: { flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 4,
    },
    progreso: { flexDirection: 'row', gap: 6 },
    paso: {
      width: 24, height: 4, borderRadius: 2,
      backgroundColor: t.hairline,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingTop: 24,
      paddingBottom: 32,
    },
    titulo:    { fontSize: 26, fontWeight: '700', color: t.ink, letterSpacing: -0.5, marginBottom: 8, fontFamily: fonts.ui },
    subtitulo: { fontSize: 13.5, color: t.ink2, lineHeight: 20, marginBottom: 28, fontFamily: fonts.ui },
    lista:     { gap: 10 },
    permisoItem: {
      flexDirection: 'row',
      gap: 14,
      padding: 16,
      borderRadius: 14,
      backgroundColor: t.card,
      borderWidth: 1,
      borderColor: t.hairline,
      alignItems: 'flex-start',
    },
    iconWrap: {
      width: 38, height: 38, borderRadius: 10,
      backgroundColor: `${t.accent}12`,
      alignItems: 'center', justifyContent: 'center',
      marginTop: 1,
    },
    permisoTitulo:{ fontSize: 14.5, fontWeight: '600', color: t.ink, fontFamily: fonts.ui },
    permisoDesc:  { fontSize: 12.5, color: t.ink2, lineHeight: 18, marginTop: 4, fontFamily: fonts.ui },
    badge: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
    },
    badgeLabel: { fontSize: 11, fontWeight: '600', fontFamily: fonts.ui },
    accionBtn: {
      marginTop: 10,
      paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8,
      backgroundColor: t.accent, alignSelf: 'flex-start',
    },
    accionBtnText: { fontSize: 12.5, fontWeight: '600', color: t.bg, fontFamily: fonts.ui },
    footer: {
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderTopWidth: 1,
      borderTopColor: t.hairline,
    },
    boton: {
      paddingVertical: 16,
      borderRadius: br.lg,
      backgroundColor: t.accent,
      alignItems: 'center',
    },
    botonTexto: { fontSize: 15.5, fontWeight: '700', color: t.bg, fontFamily: fonts.ui },
  });
}
