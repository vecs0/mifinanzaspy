/**
 * privacidad.tsx
 * Responsabilidad: Pantalla de privacidad y permisos
 * Usado por: expo-router
 * Depende de: ninguno (permisos nativos)
 */
import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  AppState, Linking, StyleSheet, Platform, AppStateStatus,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { PermissionsAndroid } from 'react-native';
import * as ExpoNotifications from 'expo-notifications';
import Svg, { Path, Circle } from 'react-native-svg';
import { useThemeCtx } from '@/services/ThemeContext';
import { colors, colorsDark, borderRadius as br } from '@/theme/design-system';

type PermStatus = 'granted' | 'denied' | 'loading';

interface PermsState {
  sms: PermStatus;
  notif: PermStatus;
  internet: PermStatus;
}

async function leerPermisos(): Promise<PermsState> {
  if (Platform.OS !== 'android') {
    const notifStatus = await ExpoNotifications.getPermissionsAsync();
    return {
      sms: 'denied',
      notif: notifStatus.granted ? 'granted' : 'denied',
      internet: 'granted',
    };
  }
  const [sms, notifStatus] = await Promise.all([
    PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_SMS).catch(() => false),
    ExpoNotifications.getPermissionsAsync().catch(() => ({ granted: false })),
  ]);
  return {
    sms: sms ? 'granted' : 'denied',
    notif: notifStatus.granted ? 'granted' : 'denied',
    internet: 'granted',
  };
}

async function concederSMS(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_SMS);
    return r === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

async function concederNotif(): Promise<boolean> {
  try {
    const r = await ExpoNotifications.requestPermissionsAsync();
    return r.granted;
  } catch {
    return false;
  }
}

function useStyles(t: typeof colors, dark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    hdr: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4,
    },
    backTxt: { fontSize: 15, fontWeight: '600', color: t.accent },
    titleBlock: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 4 },
    title: { fontSize: 24, fontWeight: '700', color: t.ink },
    subtitle: { fontSize: 12, color: t.ink3, marginTop: 4, lineHeight: 18 },
    banner: {
      marginHorizontal: 16, marginBottom: 14,
      paddingVertical: 11, paddingHorizontal: 14,
      backgroundColor: dark ? '#0d2218' : '#d8f0e6',
      borderRadius: 10,
      borderWidth: 0.5,
      borderColor: dark ? '#1a3a28' : '#a8d8c0',
      flexDirection: 'row', alignItems: 'center', gap: 9,
    },
    bannerTxt: { fontSize: 11, fontWeight: '500', color: dark ? '#6ba88f' : '#2d6b50', flex: 1 },
    card: {
      marginHorizontal: 16, marginBottom: 12,
      backgroundColor: dark ? '#181816' : t.card,
      borderRadius: 14,
      borderWidth: 0.5,
      borderColor: t.hairline,
      padding: 15,
    },
    cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, marginBottom: 8 },
    icoBox: {
      width: 34, height: 34, borderRadius: 9,
      backgroundColor: dark ? '#2a1c0c' : `${t.accent}18`,
      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    rowTop: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    permName: { fontSize: 13, fontWeight: '600', color: t.ink },
    permDesc: { fontSize: 11, color: t.ink3, lineHeight: 17, marginLeft: 45, marginBottom: 10 },
    pill: { flexDirection: 'row', alignItems: 'center', gap: 5, marginLeft: 45 },
    pillTxt: { fontSize: 11, color: dark ? '#4db88a' : '#2d7a56', fontWeight: '500' },
    primaryBtn: {
      marginLeft: 45, paddingVertical: 9, paddingHorizontal: 16,
      backgroundColor: t.accent, borderRadius: 9, alignSelf: 'flex-start',
    },
    primaryBtnTxt: { fontSize: 12, fontWeight: '700', color: dark ? '#1a1208' : '#fff' },
    outlineBtn: {
      marginLeft: 45, paddingVertical: 9, paddingHorizontal: 16,
      backgroundColor: 'transparent', borderRadius: 9, alignSelf: 'flex-start',
      borderWidth: 1, borderColor: t.accent,
    },
    outlineBtnTxt: { fontSize: 12, fontWeight: '700', color: t.accent },
    noteCard: {
      marginHorizontal: 16, marginBottom: 16,
      padding: 13,
      backgroundColor: dark ? '#0d1e2e' : '#e8f2ff',
      borderRadius: 12,
      borderWidth: 0.5,
      borderColor: dark ? '#1a3550' : '#b0ccee',
    },
    noteTitle: {
      fontSize: 11, color: dark ? '#5fa0d8' : '#2a6ab0',
      fontWeight: '600', marginBottom: 5,
      flexDirection: 'row', alignItems: 'center', gap: 5,
    },
    noteTxt: { fontSize: 11, color: dark ? '#7a9cb8' : '#4a7aaa', lineHeight: 17 },
  });
}

function StatusLabel({ status }: { status: PermStatus }) {
  if (status === 'loading') return <Text style={{ fontSize: 11, color: '#888' }}>Cargando...</Text>;
  if (status === 'granted') return <Text style={{ fontSize: 11, fontWeight: '600', color: '#4db88a' }}>Concedido</Text>;
  return <Text style={{ fontSize: 11, fontWeight: '600', color: '#e07060' }}>Denegado</Text>;
}

function SmsIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </Svg>
  );
}

function BellIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <Path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </Svg>
  );
}

function GlobeIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={12} cy={12} r={10} />
      <Path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </Svg>
  );
}

function CheckIcon({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M20 6L9 17l-5-5" />
    </Svg>
  );
}

function RefreshIcon({ color }: { color: string }) {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M23 4v6h-6M1 20v-6h6" />
      <Path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </Svg>
  );
}

export default function PrivacidadScreen() {
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;
  const s = useStyles(t, dark);
  const router = useRouter();

  const [perms, setPerms] = useState<PermsState>({ sms: 'loading', notif: 'loading', internet: 'granted' });

  const refreshPerms = useCallback(async () => {
    const p = await leerPermisos();
    setPerms(p);
  }, []);

  useEffect(() => {
    refreshPerms();
  }, [refreshPerms]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') refreshPerms();
    });
    return () => sub.remove();
  }, [refreshPerms]);

  async function handleSMS() {
    if (perms.sms === 'granted') return;
    const ok = await concederSMS();
    if (!ok) Linking.openSettings();
    else refreshPerms();
  }

  async function handleNotif() {
    if (perms.notif === 'granted') return;
    const ok = await concederNotif();
    if (!ok) Linking.openSettings();
    else refreshPerms();
  }

  const allGood = perms.sms === 'granted' && perms.notif === 'granted';

  return (
    <SafeAreaView style={s.container}>
      <View style={s.hdr}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}
        >
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none"
            stroke={t.accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M15 18l-6-6 6-6" />
          </Svg>
          <Text style={s.backTxt}>Ajustes</Text>
        </TouchableOpacity>
      </View>

      <View style={s.titleBlock}>
        <Text style={s.title}>Privacidad</Text>
        <Text style={s.subtitle}>Permisos de la app para captura automática</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingTop: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {allGood && (
          <View style={s.banner}>
            <Svg width={15} height={15} viewBox="0 0 24 24" fill="none"
              stroke={dark ? '#4db88a' : '#2d7a56'} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M20 6L9 17l-5-5" />
            </Svg>
            <Text style={s.bannerTxt}>SMS e Internet activos · captura automática funcionando</Text>
          </View>
        )}

        <View style={s.card}>
          <View style={s.cardTop}>
            <View style={s.icoBox}><SmsIcon color={t.accent} /></View>
            <View style={s.rowTop}>
              <Text style={s.permName}>Lectura de SMS</Text>
              <StatusLabel status={perms.sms} />
            </View>
          </View>
          {perms.sms === 'granted' ? (
            <View style={s.pill}>
              <CheckIcon color={dark ? '#4db88a' : '#2d7a56'} />
              <Text style={s.pillTxt}>No requiere ninguna acción</Text>
            </View>
          ) : (
            <>
              <Text style={s.permDesc}>
                Captura automáticamente los SMS bancarios para registrar tus movimientos al instante.
              </Text>
              {perms.sms === 'loading' ? null : perms.sms === 'denied' ? (
                <TouchableOpacity style={s.outlineBtn} onPress={() => Linking.openSettings()} activeOpacity={0.7}>
                  <Text style={s.outlineBtnTxt}>Activar en ajustes del sistema</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={s.primaryBtn} onPress={handleSMS} activeOpacity={0.7}>
                  <Text style={s.primaryBtnTxt}>Conceder permiso</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        <View style={s.card}>
          <View style={s.cardTop}>
            <View style={s.icoBox}><BellIcon color={t.accent} /></View>
            <View style={s.rowTop}>
              <Text style={s.permName}>Notificaciones</Text>
              <StatusLabel status={perms.notif} />
            </View>
          </View>
          {perms.notif === 'granted' ? (
            <View style={s.pill}>
              <CheckIcon color={dark ? '#4db88a' : '#2d7a56'} />
              <Text style={s.pillTxt}>No requiere ninguna acción</Text>
            </View>
          ) : (
            <>
              <Text style={s.permDesc}>
                Recibí notificaciones push de tus apps bancarias para registrar pagos y cobros al toque.
              </Text>
              {perms.notif === 'loading' ? null : (
                <TouchableOpacity style={s.outlineBtn} onPress={handleNotif} activeOpacity={0.7}>
                  <Text style={s.outlineBtnTxt}>Activar en ajustes del sistema</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        <View style={s.noteCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 5 }}>
            <RefreshIcon color={dark ? '#5fa0d8' : '#2a6ab0'} />
            <Text style={[s.noteTitle]}>Se actualiza solo</Text>
          </View>
          <Text style={s.noteTxt}>
            Esta pantalla siempre muestra el estado real del sistema operativo, nunca un valor guardado. Si activás el permiso desde Ajustes y volvés acá, el estado cambia automáticamente sin que tengas que hacer nada más.
          </Text>
        </View>

        <View style={s.card}>
          <View style={s.cardTop}>
            <View style={s.icoBox}><GlobeIcon color={t.accent} /></View>
            <View style={s.rowTop}>
              <Text style={s.permName}>Internet</Text>
              <StatusLabel status={perms.internet} />
            </View>
          </View>
          <View style={s.pill}>
            <CheckIcon color={dark ? '#4db88a' : '#2d7a56'} />
            <Text style={s.pillTxt}>No requiere ninguna acción</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
