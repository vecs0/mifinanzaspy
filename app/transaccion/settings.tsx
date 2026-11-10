/**
 * transaccion/settings.tsx
 * Responsabilidad: Configuración de cuentas bancarias (orden, toggle, eliminar)
 * Usado por: expo-router
 * Depende de: database
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, Modal, Animated,
  Switch, ActivityIndicator, LayoutAnimation,
  Platform, UIManager, KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Path, Circle } from 'react-native-svg';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
import { getCuentas, deleteCuenta, updateCuentaToggle, actualizarOrdenCuenta, getConfig, setConfig } from '@/services/database';

import { useThemeCtx, type ModoOscuro } from '@/services/ThemeContext';
import { BANCO_POR_ID } from '@/constants/banks';
import { SMS_HABILITADO } from '@/constants/features';
import { BankLogo } from '@/components/BankLogo';
import { BackupSection } from '@/components/BackupSection';
import { ArchivedSection } from '@/components/ArchivedSection';
import { colors, colorsDark, borderRadius as br } from '@/theme/design-system';
import type { CuentaBancaria } from '@/types/finance';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function useC() {
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;
  return {
    bg: t.bg, ink: t.ink, accent: t.accent,
    muted: t.ink3, border: t.hairline, card: t.card,
    negative: t.negative, negativeBg: t.negativeBg,
  };
}

function ChevronDown({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M6 9l6 6 6-6" />
    </Svg>
  );
}

function ChevronUp({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M6 15l6-6 6 6" />
    </Svg>
  );
}

function ArrowRight({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M9 5l7 7-7 7" />
    </Svg>
  );
}

function CalendarIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 9h18M9 3v4m6-4v4" />
      <Path d="M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
    </Svg>
  );
}

function GripIcon({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M9 4v2M9 11v2M9 18v2M15 4v2M15 11v2M15 18v2" />
    </Svg>
  );
}

function MailIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 6h16v12H4z" /><Path d="M4 6l8 7 8-7" />
    </Svg>
  );
}

function BellIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <Path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </Svg>
  );
}

function SmartphoneIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M6 3h12v18H6z" /><Path d="M10 18h4" />
    </Svg>
  );
}

function AppIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 2L2 7l10 5 10-5-10-5z" /><Path d="M2 17l10 5 10-5" /><Path d="M2 12l10 5 10-5" />
    </Svg>
  );
}

function ShieldIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 2l7 4v5c0 5-3.5 9.7-7 11-3.5-1.3-7-6-7-11V6l7-4z" />
    </Svg>
  );
}

function EyeIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <Circle cx={12} cy={12} r={3} />
    </Svg>
  );
}

function SunIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={12} cy={12} r={5} />
      <Path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </Svg>
  );
}

function MoonIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </Svg>
  );
}

function SystemIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5z" />
      <Path d="M8 19h8M12 16v3" />
    </Svg>
  );
}

function CuentaCard({ cuenta, expandida, onToggle, onEliminar, drag, confirmando, setConfirmando }: {
  cuenta: CuentaBancaria;
  expandida: boolean;
  onToggle: (id: string) => void;
  onEliminar: (c: CuentaBancaria) => void;
  drag: () => void;
  confirmando: boolean;
  setConfirmando: (v: boolean) => void;
}) {
  const C = useC();
  const banco = BANCO_POR_ID[cuenta.bancoId];
  const exp = expandida;
  return (
    <View style={{
      backgroundColor: C.card, borderRadius: br.lg,
      borderWidth: 1, borderColor: C.border, marginBottom: 10,
    }}>
      <TouchableOpacity
        style={{
          flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14,
        }}
        onPress={() => onToggle(cuenta.id)}
        activeOpacity={0.7}
      >
        <TouchableOpacity onPress={drag} onLongPress={drag}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          delayLongPress={100}>
          <GripIcon color={C.muted} />
        </TouchableOpacity>
        <BankLogo bancoId={cuenta.bancoId} size={34} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: C.ink }}>
            {cuenta.alias}
          </Text>
          <Text style={{ fontSize: 12, color: C.muted, marginTop: 1 }}>
            {banco?.nombre ?? cuenta.bancoNombre}
          </Text>
        </View>
        <Text style={{
          fontSize: 13, fontWeight: '700', fontFamily: 'GeistMono', color: C.ink,
        }}>
          Gs {cuenta.saldoActual.toLocaleString('es-PY').replace(/,/g, '.')}
        </Text>
        {exp ? <ChevronUp color={C.muted} /> : <ChevronDown color={C.muted} />}
      </TouchableOpacity>

      {exp && (
        <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 10 }}>
          <View style={{ height: 1, backgroundColor: C.border }} />

          <View style={{ flexDirection: 'row', gap: 20 }}>
            <View>
              <Text style={{
                fontSize: 10, color: C.muted,
                textTransform: 'uppercase', letterSpacing: 0.5,
              }}>Tipo</Text>
              <Text style={{ fontSize: 13, color: C.ink, marginTop: 2 }}>
                {cuenta.tipoCuenta}
              </Text>
            </View>
            <View>
              <Text style={{
                fontSize: 10, color: C.muted,
                textTransform: 'uppercase', letterSpacing: 0.5,
              }}>Moneda</Text>
              <Text style={{
                fontSize: 13, color: C.ink, marginTop: 2, fontFamily: 'GeistMono',
              }}>{cuenta.moneda}</Text>
            </View>
            <View>
              <Text style={{
                fontSize: 10, color: C.muted,
                textTransform: 'uppercase', letterSpacing: 0.5,
              }}>Desde</Text>
              <Text style={{ fontSize: 13, color: C.ink, marginTop: 2 }}>
                {cuenta.fechaCreacion?.slice(0, 10) ?? '-'}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 20 }}>
            {SMS_HABILITADO && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 12, color: C.muted }}>SMS</Text>
                <Switch value={cuenta.smsHabilitado}
                  trackColor={{ true: C.accent, false: C.border }}
                  thumbColor="#fff"
                  onValueChange={v => updateCuentaToggle(cuenta.id, 'sms_habilitado', v)} />
              </View>
            )}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 12, color: C.muted }}>Notif</Text>
              <Switch value={cuenta.notifHabilitada}
                trackColor={{ true: C.accent, false: C.border }}
                thumbColor="#fff"
                onValueChange={v => updateCuentaToggle(cuenta.id, 'notif_habilitada', v)} />
            </View>
          </View>

          <TouchableOpacity
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 6,
              paddingVertical: 8, paddingHorizontal: 10,
              borderRadius: br.sm, backgroundColor: C.negativeBg,
              alignSelf: 'flex-start',
            }}
            onPress={() => setConfirmando(true)}
          >
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none"
              stroke={C.negative} strokeWidth={2} strokeLinecap="round">
              <Path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
            </Svg>
            <Text style={{ fontSize: 12, fontWeight: '500', color: C.negative }}>
              Eliminar cuenta
            </Text>
          </TouchableOpacity>
          <ConfirmModal visible={confirmando} titulo="Eliminar cuenta"
            mensaje={`¿Estás seguro de eliminar ${cuenta.alias}? Los movimientos se conservan.`}
            labelCancelar="Cancelar" labelConfirmar="Eliminar" destructive
            onCancel={() => setConfirmando(false)}
            onConfirm={() => { setConfirmando(false); onEliminar(cuenta); }} />
        </View>
      )}
    </View>
  );
}

function ConfirmModal({ visible, titulo, mensaje, labelCancelar, labelConfirmar, onCancel, onConfirm, destructive }: {
  visible: boolean; titulo: string; mensaje: string;
  labelCancelar?: string; labelConfirmar?: string;
  onCancel: () => void; onConfirm: () => void; destructive?: boolean;
}) {
  const C = useC();
  return (
    <Modal visible={visible} transparent animationType="fade"
      onRequestClose={onCancel}>
      <View style={{
        flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end',
      }}>
        <TouchableOpacity style={{ flex: 1 }} onPress={onCancel} />
        <View style={{
          backgroundColor: C.card, borderTopLeftRadius: br.xl, borderTopRightRadius: br.xl,
          paddingTop: 24, paddingHorizontal: 22, paddingBottom: 36, gap: 16,
        }}>
          <View style={{
            width: 36, height: 4, borderRadius: 2, backgroundColor: C.border,
            alignSelf: 'center', marginBottom: 4,
          }} />
          {destructive && (
            <View style={{
              width: 44, height: 44, borderRadius: 12, backgroundColor: C.negativeBg,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"
                stroke={C.negative} strokeWidth={1.8} strokeLinecap="round">
                <Path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
              </Svg>
            </View>
          )}
          <Text style={{ fontSize: 17, fontWeight: '700', color: C.ink }}>{titulo}</Text>
          <Text style={{ fontSize: 13.5, color: C.muted, lineHeight: 20 }}>{mensaje}</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
            <TouchableOpacity style={{
              flex: 1, paddingVertical: 14, borderRadius: br.md,
              backgroundColor: C.border, alignItems: 'center',
            }} onPress={onCancel} activeOpacity={0.7}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: C.ink }}>
                {labelCancelar ?? 'Cancelar'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={{
              flex: 1, paddingVertical: 14, borderRadius: br.md,
              backgroundColor: destructive ? C.negative : C.accent, alignItems: 'center',
            }} onPress={onConfirm} activeOpacity={0.7}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: C.bg }}>
                {labelConfirmar ?? 'Confirmar'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Toast({ visible, mensaje, onDismiss }: {
  visible: boolean; mensaje: string; onDismiss: () => void;
}) {
  const C = useC();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(opacity, { toValue: 1, useNativeDriver: true, damping: 20, stiffness: 200 }),
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 200 }),
      ]).start();

      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: 30, duration: 250, useNativeDriver: true }),
        ]).start(() => onDismiss());
      }, 2200);

      return () => clearTimeout(timer);
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View style={{
      position: 'absolute', bottom: 100, left: 20, right: 20,
      opacity, transform: [{ translateY }],
      zIndex: 999, elevation: 10,
    }}>
      <View style={{
        backgroundColor: C.ink, borderRadius: br.lg,
        paddingVertical: 14, paddingHorizontal: 18,
        flexDirection: 'row', alignItems: 'center', gap: 12,
        shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2, shadowRadius: 12, elevation: 8,
      }}>
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"
          stroke={C.bg} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
        </Svg>
        <Text style={{
          flex: 1, fontSize: 13.5, color: C.bg, fontWeight: '500',
        }}>{mensaje}</Text>
      </View>
    </Animated.View>
  );
}

function CapturaSection() {
  const C = useC();
  const [smsOn, setSmsOn] = useState(() => getConfig('captura_sms') === 'true');
  const [notifOn, setNotifOn] = useState(() => getConfig('captura_notif') === 'true');
  const [showEmail, setShowEmail] = useState(false);
  const router = useRouter();
  return (
    <>
      <Text style={{
        fontSize: 11, fontWeight: '600', color: C.muted,
        textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8,
      }}>Captura automática</Text>

      <View style={{
        backgroundColor: C.card, borderRadius: br.lg, borderWidth: 1,
        borderColor: C.border, overflow: 'hidden', marginBottom: 20,
      }}>
        {SMS_HABILITADO && (
          <>
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
            }}>
              <SmartphoneIcon color={C.muted} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '500', color: C.ink }}>SMS bancarios</Text>
                <Text style={{ fontSize: 12, color: C.muted, marginTop: 1 }}>
                  Capturá transacciones de tus SMS
                </Text>
              </View>
              <Switch value={smsOn} trackColor={{ true: C.accent, false: C.border }}
                thumbColor="#fff"
                onValueChange={v => { setSmsOn(v); setConfig('captura_sms', v ? 'true' : 'false'); }} />
            </View>
            <View style={{ height: 1, backgroundColor: C.border, marginLeft: 14 }} />
          </>
        )}
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
        }}>
          <BellIcon color={C.muted} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '500', color: C.ink }}>Notificaciones de apps</Text>
            <Text style={{ fontSize: 12, color: C.muted, marginTop: 1 }}>
              Capturá transacciones desde notificaciones push
            </Text>
          </View>
          <Switch value={notifOn} trackColor={{ true: C.accent, false: C.border }}
            thumbColor="#fff"
            onValueChange={v => { setNotifOn(v); setConfig('captura_notif', v ? 'true' : 'false'); }} />
        </View>
        <View style={{ height: 1, backgroundColor: C.border, marginLeft: 14 }} />
        <TouchableOpacity style={{
          flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
        }} onPress={() => setShowEmail(true)} activeOpacity={0.7}>
          <MailIcon color={C.muted} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '500', color: C.ink }}>Email Gmail OAuth</Text>
            <Text style={{ fontSize: 12, color: C.muted, marginTop: 1 }}>
              Escaneá recibos y comprobantes desde tu correo
            </Text>
          </View>
          <ArrowRight color={C.muted} />
        </TouchableOpacity>
      </View>

      <Modal visible={showEmail} transparent animationType="fade"
        onRequestClose={() => setShowEmail(false)}>
        <View style={{
          flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end',
        }}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setShowEmail(false)} />
          <View style={{
            backgroundColor: C.card, borderTopLeftRadius: br.xl, borderTopRightRadius: br.xl,
            paddingTop: 24, paddingHorizontal: 22, paddingBottom: 36, gap: 16,
          }}>
            <View style={{
              width: 36, height: 4, borderRadius: 2, backgroundColor: C.border,
              alignSelf: 'center', marginBottom: 4,
            }} />
            <View style={{
              width: 44, height: 44, borderRadius: 12, backgroundColor: `${C.accent}15`,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <MailIcon color={C.muted} />
            </View>
            <Text style={{ fontSize: 17, fontWeight: '700', color: C.ink }}>Email Gmail OAuth</Text>
            <Text style={{ fontSize: 13.5, color: C.muted, lineHeight: 20 }}>
              Esta función estará disponible próximamente. Te permitirá escanear recibos y comprobantes directamente desde tu correo Gmail.
            </Text>
            <TouchableOpacity style={{
              paddingVertical: 14, borderRadius: br.md,
              backgroundColor: C.accent, alignItems: 'center',
            }} onPress={() => setShowEmail(false)} activeOpacity={0.7}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: C.bg }}>
                Entendido
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

function AppSection() {
  const C = useC();
  const router = useRouter();
  const { dark, mode, setModo } = useThemeCtx();
  const [showTheme, setShowTheme] = useState(false);

  const opciones: { label: string; value: ModoOscuro; icon: 'sun' | 'moon' | 'system' }[] = [
    { label: 'Claro', value: 'light', icon: 'sun' },
    { label: 'Oscuro', value: 'dark', icon: 'moon' },
    { label: 'Sistema', value: 'system', icon: 'system' },
  ];

  return (
    <>
      <Text style={{
        fontSize: 11, fontWeight: '600', color: C.muted,
        textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8,
      }}>App</Text>

      <View style={{
        backgroundColor: C.card, borderRadius: br.lg, borderWidth: 1,
        borderColor: C.border, overflow: 'hidden', marginBottom: 20,
      }}>
        <TouchableOpacity style={{
          flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
        }} onPress={() => setShowTheme(true)} activeOpacity={0.7}>
          <EyeIcon color={C.muted} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '500', color: C.ink }}>Apariencia</Text>
            <Text style={{ fontSize: 12, color: C.muted, marginTop: 1 }}>
              {mode === 'light' ? 'Claro' : mode === 'dark' ? 'Oscuro' : 'Según el sistema'}
            </Text>
          </View>
          <ArrowRight color={C.muted} />
        </TouchableOpacity>
        <View style={{ height: 1, backgroundColor: C.border, marginLeft: 14 }} />
        <TouchableOpacity style={{
          flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
        }} onPress={() => router.push('/chat' as any)} activeOpacity={0.7}>
          <AppIcon color={C.muted} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '500', color: C.ink }}>Preguntale a tu Asesor IA</Text>
            <Text style={{ fontSize: 12, color: C.muted, marginTop: 1 }}>Consultas, análisis y plan financiero</Text>
          </View>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none"
            stroke={C.accent} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M7 17L17 7M17 7H7M17 7v10" />
          </Svg>
        </TouchableOpacity>
        <View style={{ height: 1, backgroundColor: C.border, marginLeft: 14 }} />
        <TouchableOpacity style={{
          flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
        }} onPress={() => router.push('/privacidad' as any)} activeOpacity={0.7}>
          <ShieldIcon color={C.muted} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '500', color: C.ink }}>Privacidad</Text>
            <Text style={{ fontSize: 12, color: C.muted, marginTop: 1 }}>
              Permisos de notificaciones y más
            </Text>
          </View>
          <ArrowRight color={C.muted} />
        </TouchableOpacity>
        <View style={{ height: 1, backgroundColor: C.border, marginLeft: 14 }} />
        <TouchableOpacity style={{
          flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
        }} onPress={() => router.push('/recordatorios' as any)} activeOpacity={0.7}>
          <CalendarIcon color={C.muted} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '500', color: C.ink }}>Recordatorios</Text>
            <Text style={{ fontSize: 12, color: C.muted, marginTop: 1 }}>
              ANDE, ESSAP, tarjetas y más
            </Text>
          </View>
          <ArrowRight color={C.muted} />
        </TouchableOpacity>
      </View>

      <Modal visible={showTheme} transparent animationType="fade"
        onRequestClose={() => setShowTheme(false)}>
        <View style={{
          flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center',
          padding: 32,
        }}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setShowTheme(false)} />
          <View style={{
            backgroundColor: dark ? '#2C2823' : C.card, borderRadius: br.xl, padding: 24, gap: 12,
          }}>
            <Text style={{
              fontSize: 17, fontWeight: '700', color: C.ink, textAlign: 'center', marginBottom: 4,
            }}>Apariencia</Text>
            {opciones.map(o => {
              const activo = mode === o.value;
              return (
                <TouchableOpacity key={o.value}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 12,
                    padding: 14, borderRadius: br.md,
                    backgroundColor: activo ? `${C.accent}12` : 'transparent',
                    borderWidth: 1, borderColor: activo ? C.accent : 'transparent',
                  }}
                  onPress={() => { setModo(o.value); setShowTheme(false); }}
                  activeOpacity={0.7}>
                  {o.icon === 'sun' ? <SunIcon color={C.muted} /> : o.icon === 'moon' ? <MoonIcon color={C.muted} /> : <SystemIcon color={C.muted} />}
                  <Text style={{
                    flex: 1, fontSize: 14.5, fontWeight: activo ? '600' : '400', color: C.ink,
                  }}>{o.label}</Text>
                  {activo && (
                    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"
                      stroke={C.accent} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                      <Path d="M20 6L9 17l-5-5" />
                    </Svg>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Modal>
    </>
  );
}

export default function SettingsScreen() {
  const C = useC();
  const router = useRouter();
  const [cuentas, setCuentas] = useState<CuentaBancaria[]>([]);
  const [cargando, setCargando] = useState(true);
  const [expandida, setExpandida] = useState<string | null>(null);
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);
  const [toastMensaje, setToastMensaje] = useState('');
  const [toastKey, setToastKey] = useState(0);

  useEffect(() => {
    const c = getCuentas();
    setCuentas(c);
    setCargando(false);
  }, []);

  function recargarCuentas() {
    setCuentas(getCuentas());
  }

  function toggleExpand(id: string) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandida(prev => prev === id ? null : id);
  }

  function mostrarToast(msg: string) {
    setToastMensaje(msg);
    setToastKey(prev => prev + 1);
  }

  function eliminarCuenta(cuenta: CuentaBancaria) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    deleteCuenta(cuenta.id);
    setCuentas(prev => prev.filter(c => c.id !== cuenta.id));
    mostrarToast(`${cuenta.alias} eliminada`);
  }

  const renderItem = useCallback(({ item, drag, isActive }: { item: CuentaBancaria; drag: () => void; isActive: boolean }) => {
    return (
      <ScaleDecorator>
        <View style={{ opacity: isActive ? 0.85 : 1 }}>
          <CuentaCard
            cuenta={item}
            expandida={expandida === item.id}
            onToggle={toggleExpand}
            onEliminar={eliminarCuenta}
            drag={drag}
            confirmando={confirmandoId === item.id}
            setConfirmando={v => setConfirmandoId(v ? item.id : null)}
          />
        </View>
      </ScaleDecorator>
    );
  }, [expandida, toggleExpand, eliminarCuenta, confirmandoId]);

  const listHeader = (
    <>
      <Text style={{
        fontSize: 11, fontWeight: '600', color: C.muted,
        textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 4,
      }}>Cuentas</Text>
      <Text style={{
        fontSize: 11.5, color: C.muted, marginBottom: 12,
      }}>Mantené presionado ⋮ para ordenar</Text>

      {cuentas.length === 0 && (
        <View style={{ alignItems: 'center', paddingTop: 24, paddingBottom: 16, gap: 12 }}>
          <Text style={{ fontSize: 15, color: C.muted }}>
            No tenés cuentas configuradas.
          </Text>
          <TouchableOpacity onPress={() => router.push('/onboarding/bancos')}>
            <Text style={{ color: C.accent, fontWeight: '600', fontSize: 14 }}>
              Agregar cuentas →
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </>
  );

  const listFooter = (
    <View style={{ paddingTop: 4 }}>
      <TouchableOpacity
        style={{
          paddingVertical: 14, borderRadius: br.md, borderWidth: 1,
          borderColor: C.border, borderStyle: 'dashed', alignItems: 'center', marginBottom: 20,
        }}
        onPress={() => router.push('/onboarding/bancos')}
      >
        <Text style={{ fontSize: 14, color: C.accent, fontWeight: '500' }}>
          + Agregar cuenta
        </Text>
      </TouchableOpacity>

      <CapturaSection />
      <AppSection />
      <ArchivedSection onCambio={recargarCuentas} />
      <BackupSection />
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{
        paddingHorizontal: 22, paddingTop: 14, paddingBottom: 8,
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <TouchableOpacity onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"
            stroke={C.ink} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M15 5l-7 7 7 7" />
          </Svg>
        </TouchableOpacity>
        <Text style={{ fontSize: 16, fontWeight: '600', color: C.ink }}>Ajustes</Text>
        <View style={{ width: 20 }} />
      </View>

      {cargando ? (
        <ActivityIndicator color={C.accent} style={{ marginTop: 40 }} />
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
          <DraggableFlatList
            data={cuentas}
            onDragEnd={({ data }) => {
              setCuentas(data);
              data.forEach((c, i) => actualizarOrdenCuenta(c.id, i + 1));
            }}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            ListHeaderComponent={listHeader}
            ListFooterComponent={listFooter}
            contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
            keyboardShouldPersistTaps="handled"
          />
        </KeyboardAvoidingView>
      )}
      <Toast key={toastKey} visible={toastKey > 0} mensaje={toastMensaje}
        onDismiss={() => setToastKey(0)} />
    </SafeAreaView>
  );
}
