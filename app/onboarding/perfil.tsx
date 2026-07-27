/**
 * onboarding/perfil.tsx
 * Responsabilidad: Paso 2 de onboarding — Datos del perfil
 * Usado por: expo-router (onboarding flow)
 * Depende de: database
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import Svg, { Path, Circle } from 'react-native-svg';
import { setConfig, getConfig } from '@/services/database';
import { useThemeCtx } from '@/services/ThemeContext';
import { colors, colorsDark, borderRadius as br } from '@/theme/design-system';


export default function PerfilScreen() {
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;
  const s = useStyles(t);
  const router = useRouter();
  const [nombre, setNombre] = useState('');
  const [dia, setDia] = useState('');
  const [mes, setMes] = useState('');
  const [anio, setAnio] = useState('');
  const [foto, setFoto] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const refDia = useRef<TextInput>(null);
  const refMes = useRef<TextInput>(null);
  const refAnio = useRef<TextInput>(null);

  const puedeAvanzar = nombre.trim().length > 0;

  useEffect(() => {
    const savedNombre = getConfig('perfil_nombre');
    const savedFoto = getConfig('perfil_foto');
    const savedFecha = getConfig('perfil_fecha_nacimiento');
    if (savedNombre) { setNombre(savedNombre); }
    if (savedFoto) { setFoto(savedFoto); }
    if (savedFecha) {
      const partes = savedFecha.split('/');
      if (partes.length === 3) {
        setDia(partes[0]);
        setMes(partes[1]);
        setAnio(partes[2]);
      }
    }
  }, []);

  const guardarNombre = useCallback((v: string) => {
    setNombre(v);
    if (v.trim()) setConfig('perfil_nombre', v.trim());
  }, []);

  async function elegirFoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.6, base64: true,
    });
    if (!res.canceled && res.assets[0]?.base64) {
      const uri = `data:image/jpeg;base64,${res.assets[0].base64}`;
      setFoto(uri);
      setConfig('perfil_foto', uri);
    }
  }

  async function continuar() {
    if (guardando) return;
    setGuardando(true);
    try {
      setConfig('perfil_nombre', nombre.trim());
      const fechaValida = dia.length === 2 && mes.length === 2 && anio.length === 4;
      if (fechaValida) {
        setConfig('perfil_fecha_nacimiento', `${dia}/${mes}/${anio}`);
      }
      if (foto) setConfig('perfil_foto', foto);
      router.push('/onboarding/objetivos' as any);
    } catch {
      Alert.alert('Error', 'No se pudo guardar tu perfil. Intentá de nuevo.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 25}
      >
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 12 }}>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M19 12H5M12 19l-7-7 7-7" />
            </Svg>
            <Text style={{ color: t.accent, fontSize: 13, fontWeight: '500' }}>Atrás</Text>
          </TouchableOpacity>
          <View style={s.stepsRow}>
            {[0, 1, 2, 3, 4].map(i => (
              <View key={i} style={[s.dot, i === 1 && s.dotActive, i < 1 && s.dotDone]} />
            ))}
          </View>
          <Text style={s.pasoNum}>2/5</Text>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={s.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={s.hero}>
            <TouchableOpacity onPress={elegirFoto} activeOpacity={0.8}>
              <View style={s.avatarWrap}>
                {foto ? (
                  <Image source={{ uri: foto }} style={s.avatarImg} />
                ) : (
                  <View style={s.avatarPlaceholder}>
                    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
                      <Circle cx="12" cy="8" r="5" stroke={t.muted} strokeWidth={1.8} />
                      <Path d="M3 21c2-5 5.5-7 9-7s7 2 9 7" stroke={t.muted} strokeWidth={1.8} strokeLinecap="round" />
                    </Svg>
                  </View>
                )}
                <View style={s.camBadge}>
                  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                    <Path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2v11z" stroke={t.bg} strokeWidth={2.5} strokeLinecap="round" />
                    <Circle cx="12" cy="13" r="4" stroke={t.bg} strokeWidth={2.5} />
                  </Svg>
                </View>
              </View>
            </TouchableOpacity>
            <Text style={s.heroTitle}>¿Cómo te{'\n'}llamamos?</Text>
            <Text style={s.heroSub}>Paso 2 de 5 · Tu perfil</Text>
          </View>

          <View style={s.card}>
            <View style={s.fieldGroup}>
              <Text style={s.label}>Tu nombre</Text>
              <TextInput
                style={s.input}
                value={nombre}
                onChangeText={guardarNombre}
                placeholder="Nombre o apodo"
                placeholderTextColor={t.muted}
                autoFocus
                maxLength={60}
                returnKeyType="next"
                onSubmitEditing={() => refDia.current?.focus()}
              />
              <Text style={s.charHint}>{nombre.length}/60</Text>
            </View>

            <View style={s.divider} />

            <View style={s.fieldGroup}>
              <Text style={s.label}>Fecha de nacimiento</Text>
              <View style={s.fechaRow}>
                  <TextInput
                    ref={refDia}
                    style={s.fechaBox}
                    value={dia}
                    onChangeText={v => {
                      const d = v.replace(/\D/g, '').slice(0, 2);
                      setDia(d);
                      if (d.length >= 2) refMes.current?.focus();
                      if (d.length === 2 && mes.length === 2 && anio.length === 4) {
                        setConfig('perfil_fecha_nacimiento', `${d}/${mes}/${anio}`);
                      }
                    }}
                  placeholder="DD"
                  placeholderTextColor={t.muted}
                  keyboardType="number-pad"
                  maxLength={2}
                  textAlign="center"
                  returnKeyType="next"
                  onSubmitEditing={() => refMes.current?.focus()}
                />
                <Text style={s.fechaSep}>/</Text>
                <TextInput
                  ref={refMes}
                  style={s.fechaBox}
                  value={mes}
                  onChangeText={v => {
                      const m = v.replace(/\D/g, '').slice(0, 2);
                      setMes(m);
                      if (m.length >= 2) refAnio.current?.focus();
                      if (dia.length === 2 && m.length === 2 && anio.length === 4) {
                        setConfig('perfil_fecha_nacimiento', `${dia}/${m}/${anio}`);
                      }
                    }}
                  placeholder="MM"
                  placeholderTextColor={t.muted}
                  keyboardType="number-pad"
                  maxLength={2}
                  textAlign="center"
                  returnKeyType="next"
                  onSubmitEditing={() => refAnio.current?.focus()}
                />
                <Text style={s.fechaSep}>/</Text>
                <TextInput
                  ref={refAnio}
                  style={[s.fechaBox, s.fechaBoxAnio]}
                  value={anio}
                  onChangeText={v => {
                      const a = v.replace(/\D/g, '').slice(0, 4);
                      setAnio(a);
                      if (dia.length === 2 && mes.length === 2 && a.length === 4) {
                        setConfig('perfil_fecha_nacimiento', `${dia}/${mes}/${a}`);
                      }
                    }}
                  placeholder="AAAA"
                  placeholderTextColor={t.muted}
                  keyboardType="number-pad"
                  maxLength={4}
                  textAlign="center"
                />
              </View>
              <Text style={s.fechaHint}>
                Solo para ajustar consejos según tu etapa de vida.
              </Text>
            </View>
          </View>
        </ScrollView>

        <View style={s.footer}>
          <TouchableOpacity
            style={[s.boton, (!puedeAvanzar || guardando) && s.botonDisabled]}
            onPress={continuar}
            disabled={!puedeAvanzar || guardando}
            activeOpacity={0.85}
          >
            <Text style={s.botonTexto}>
              {nombre.trim() ? `Soy ${nombre.trim().split(' ')[0]} →` : 'Continuar →'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/onboarding/objetivos' as any)}>
            <Text style={s.saltear}>Saltar por ahora</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function useStyles(t: typeof colors) {
  return StyleSheet.create({
    header: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingHorizontal: 22, paddingTop: 14, paddingBottom: 10,
    },
    stepsRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: t.hairline },
    dotActive: { width: 22, height: 8, borderRadius: 4, backgroundColor: t.accent },
    dotDone: { backgroundColor: t.accent, opacity: 0.5 },
    pasoNum: { fontSize: 11, color: t.muted, fontFamily: 'GeistMono' },

    scrollContent: { paddingBottom: 120 },

    hero: { alignItems: 'center', paddingTop: 20, paddingBottom: 28, paddingHorizontal: 22 },
    avatarWrap: { position: 'relative', marginBottom: 20 },
    avatarImg: { width: 88, height: 88, borderRadius: 44, borderWidth: 2, borderColor: t.accent },
    avatarPlaceholder: {
      width: 88, height: 88, borderRadius: 44,
      backgroundColor: t.card, borderWidth: 2, borderColor: t.hairline,
      borderStyle: 'dashed',
      alignItems: 'center', justifyContent: 'center',
    },
    camBadge: {
      position: 'absolute', bottom: 0, right: -2,
      width: 28, height: 28, borderRadius: 14,
      backgroundColor: t.accent,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 2, borderColor: t.bg,
    },
    heroTitle: {
      fontSize: 30, fontWeight: '700', color: t.ink,
      textAlign: 'center', lineHeight: 36, fontFamily: 'Geist',
    },
    heroSub: { fontSize: 12, color: t.muted, marginTop: 8, fontFamily: 'Geist' },

    card: {
      marginHorizontal: 22, borderRadius: br.xl,
      backgroundColor: t.card, borderWidth: 1, borderColor: t.hairline,
      padding: 20, gap: 6,
    },
    fieldGroup: { gap: 6 },
    label: {
      fontSize: 10, fontWeight: '600', color: t.muted,
      textTransform: 'uppercase', letterSpacing: 1.2, fontFamily: 'Geist',
    },
    input: {
      fontSize: 17, color: t.ink, padding: 14, borderRadius: br.lg,
      backgroundColor: t.bg, borderWidth: 1, borderColor: 'rgba(24,21,19,0.08)',
      fontFamily: 'Geist',
    },
    charHint: { fontSize: 10, color: t.muted, textAlign: 'right', fontFamily: 'GeistMono' },
    divider: { height: 1, backgroundColor: t.hairline, marginVertical: 8 },
    fechaRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
    fechaBox: {
      flex: 1, height: 52, borderRadius: br.lg,
      backgroundColor: t.bg, borderWidth: 1, borderColor: 'rgba(24,21,19,0.08)',
      fontFamily: 'GeistMono', fontSize: 17, fontWeight: '500',
      letterSpacing: 1, color: t.ink,
    },
    fechaBoxAnio: { flex: 1.4 },
    fechaSep: { fontSize: 18, color: t.muted, fontFamily: 'Geist' },
    fechaHint: { fontSize: 11, color: t.muted, marginTop: 6, lineHeight: 16, fontFamily: 'Geist' },

    footer: {
      paddingHorizontal: 22, paddingBottom: Platform.OS === 'ios' ? 8 : 20,
      paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.hairline,
      gap: 12,
    },
    boton: {
      height: 52, borderRadius: br.lg,
      backgroundColor: t.ink, alignItems: 'center', justifyContent: 'center',
    },
    botonDisabled: { opacity: 0.4 },
    botonTexto: { fontSize: 15, fontWeight: '600', color: t.bg, fontFamily: 'Geist', letterSpacing: 0.1 },
    saltear: { fontSize: 12, color: t.muted, fontFamily: 'Geist', textAlign: 'center' },
  });
}
