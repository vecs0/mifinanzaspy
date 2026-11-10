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
import { colors, colorsDark, borderRadius as br, iconStroke, hit } from '@/theme/design-system';
import { SMS_HABILITADO } from '@/constants/features';

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
    SMS_HABILITADO
      ? PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_SMS).catch(() => false)
      : false,
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

function useStyles(t: typeof colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    hdr: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 12, paddingTop: 4,
    },
    backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 44, paddingHorizontal: 4 },
    backTxt: { fontSize: 15, fontWeight: '600', color: t.accent },
    titleBlock: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 8 },
    title: { fontSize: 26, fontWeight: '700', color: t.ink },
    subtitle: { fontSize: 14, color: t.ink2, marginTop: 4, lineHeight: 20 },
    banner: {
      marginHorizontal: 24, marginBottom: 16,
      paddingVertical: 12, paddingHorizontal: 16,
      backgroundColor: t.positiveBg,
      borderRadius: br.md,
      flexDirection: 'row', alignItems: 'center', gap: 8,
    },
    bannerTxt: { fontSize: 13, fontWeight: '500', color: t.positive, flex: 1 },
    item: {
      marginHorizontal: 24,
      paddingVertical: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.hairline,
    },
    cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
    icoBox: {
      width: 40, height: 40, borderRadius: br.md,
      backgroundColor: t.accentBg,
      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    rowTop: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    permName: { fontSize: 15, fontWeight: '600', color: t.ink },
    permDesc: { fontSize: 13, color: t.ink2, lineHeight: 19, marginLeft: 52, marginBottom: 12 },
    pill: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 52 },
    pillTxt: { fontSize: 13, color: t.positive, fontWeight: '500' },
    primaryBtn: {
      marginLeft: 52, minHeight: 44, paddingHorizontal: 16, justifyContent: 'center',
      backgroundColor: t.accent, borderRadius: br.md, alignSelf: 'flex-start',
    },
    primaryBtnTxt: { fontSize: 14, fontWeight: '600', color: t.onAccent },
    outlineBtn: {
      marginLeft: 52, minHeight: 44, paddingHorizontal: 16, justifyContent: 'center',
      backgroundColor: 'transparent', borderRadius: br.md, alignSelf: 'flex-start',
      borderWidth: 1, borderColor: t.accent,
    },
    outlineBtnTxt: { fontSize: 14, fontWeight: '600', color: t.accent },
    note: { marginHorizontal: 24, paddingVertical: 16 },
    noteTitle: { fontSize: 13, color: t.ink, fontWeight: '600' },
    noteTxt: { fontSize: 13, color: t.ink2, lineHeight: 19 },
  });
}

function StatusLabel({ status, t }: { status: PermStatus; t: typeof colors }) {
  if (status === 'loading') return <Text style={{ fontSize: 13, color: t.muteText }}>Cargando</Text>;
  if (status === 'granted') return <Text style={{ fontSize: 13, fontWeight: '600', color: t.positive }}>Concedido</Text>;
  return <Text style={{ fontSize: 13, fontWeight: '600', color: t.negative }}>Denegado</Text>;
}

function SmsIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={iconStroke} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </Svg>
  );
}

function BellIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={iconStroke} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <Path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </Svg>
  );
}

function GlobeIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={iconStroke} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={12} cy={12} r={10} />
      <Path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </Svg>
  );
}

function CheckIcon({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
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
  const s = useStyles(t);
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

  const allGood = (SMS_HABILITADO ? perms.sms === 'granted' : true) && perms.notif === 'granted';

  return (
    <SafeAreaView style={s.container}>
      <View style={s.hdr}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={hit}
          style={s.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Volver a Ajustes"
        >
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none"
            stroke={t.accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M15 18l-6-6 6-6" />
          </Svg>
          <Text style={s.backTxt}>Ajustes</Text>
        </TouchableOpacity>
      </View>

      <View style={s.titleBlock}>
        <Text style={s.title} accessibilityRole="header">Privacidad</Text>
        <Text style={s.subtitle}>Permisos de la app para captura automática</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingTop: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {allGood && (
          <View style={s.banner}>
            <Svg width={15} height={15} viewBox="0 0 24 24" fill="none"
              stroke={t.positive} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M20 6L9 17l-5-5" />
            </Svg>
            <Text style={s.bannerTxt}>
              {SMS_HABILITADO
                ? 'SMS e Internet activos · captura automática funcionando'
                : 'Notificaciones e Internet activos · captura automática funcionando'}
            </Text>
          </View>
        )}

        {SMS_HABILITADO && (
          <View style={s.item}>
            <View style={s.cardTop}>
              <View style={s.icoBox}><SmsIcon color={t.accent} /></View>
              <View style={s.rowTop}>
                <Text style={s.permName}>Lectura de SMS</Text>
                <StatusLabel status={perms.sms} t={t} />
              </View>
            </View>
            {perms.sms === 'granted' ? (
              <View style={s.pill}>
                <CheckIcon color={t.positive} />
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
        )}

        <View style={s.item}>
          <View style={s.cardTop}>
            <View style={s.icoBox}><BellIcon color={t.accent} /></View>
            <View style={s.rowTop}>
              <Text style={s.permName}>Notificaciones</Text>
              <StatusLabel status={perms.notif} t={t} />
            </View>
          </View>
          {perms.notif === 'granted' ? (
            <View style={s.pill}>
              <CheckIcon color={t.positive} />
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

        <View style={s.note}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 5 }}>
            <RefreshIcon color={t.accent} />
            <Text style={[s.noteTitle]}>Se actualiza solo</Text>
          </View>
          <Text style={s.noteTxt}>
            Esta pantalla siempre muestra el estado real del sistema operativo, nunca un valor guardado. Si activás el permiso desde Ajustes y volvés acá, el estado cambia automáticamente sin que tengas que hacer nada más.
          </Text>
        </View>

        <View style={s.item}>
          <View style={s.cardTop}>
            <View style={s.icoBox}><GlobeIcon color={t.accent} /></View>
            <View style={s.rowTop}>
              <Text style={s.permName}>Internet</Text>
              <StatusLabel status={perms.internet} t={t} />
            </View>
          </View>
          <View style={s.pill}>
            <CheckIcon color={t.positive} />
            <Text style={s.pillTxt}>No requiere ninguna acción</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
