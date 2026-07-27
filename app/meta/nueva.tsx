/**
 * meta/nueva.tsx
 * Responsabilidad: Crear / Editar meta de ahorro
 * Usado por: crecer.tsx (router.push)
 * Depende de: metas
 */
import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Svg, { Path, Rect, Line } from 'react-native-svg';
import { useThemeCtx } from '@/services/ThemeContext';
import { colors, colorsDark, fonts, borderRadius as br } from '@/theme/design-system';
import { insertMeta, getMeta, updateMeta, type TipoMeta } from '@/services/metas';

function parseGs(v: string): number {
  return parseInt(v.replace(/\D/g, ''), 10) || 0;
}

function formatGs(n: number): string {
  if (n === 0) return '';
  return n.toLocaleString('es-PY').replace(/,/g, '.');
}

const ICONOS = [
  { id: 'home',        label: 'Hogar',     emoji: '🏠' },
  { id: 'briefcase',   label: 'Trabajo',   emoji: '💼' },
  { id: 'shield',      label: 'Urgencia',  emoji: '🛡️' },
  { id: 'credit-card', label: 'Deuda',     emoji: '💳' },
  { id: 'trend-up',    label: 'Inversión', emoji: '📈' },
  { id: 'sparkles',    label: 'Otro',      emoji: '✨' },
];

function IconoBtn({ id, label, emoji, selected, onPress, t, accent }: {
  id: string; label: string; emoji: string; selected: boolean;
  onPress: () => void; t: typeof colors; accent: string;
}) {
  return (
    <TouchableOpacity
      style={[ib.btn,
        { backgroundColor: selected ? 'rgba(179,106,42,0.08)' : t.card, borderColor: selected ? accent : t.hairline },
      ]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={{ fontSize: 20 }}>{emoji}</Text>
      <Text style={[ib.label, { color: selected ? accent : t.ink3 }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const ib = StyleSheet.create({
  btn:   { width: 72, alignItems: 'center', paddingVertical: 10, borderRadius: 12, borderWidth: 1, gap: 4 },
  label: { fontSize: 10, fontFamily: fonts.ui, fontWeight: '500' },
});

export default function NuevaMetaScreen() {
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;
  const router = useRouter();
  const { tipo: tipoParam, id: idParam } = useLocalSearchParams<{ tipo?: string; id?: string }>();

  const isEdit = !!idParam;
  const tipo   = (tipoParam ?? 'solo') as TipoMeta;

  const [titulo,      setTitulo]      = useState('');
  const [montoStr,    setMontoStr]    = useState('');
  const [diasStr,     setDiasStr]     = useState('30');
  const [icono,       setIcono]       = useState('sparkles');
  const [miembroStr,  setMiembroStr]  = useState('');
  const [miembros,    setMiembros]    = useState<string[]>([]);
  const [guardando,   setGuardando]   = useState(false);
  const [listo,       setListo]       = useState(!isEdit);

  useEffect(() => {
    if (!idParam) return;
    const m = getMeta(idParam);
    if (m) {
      setTitulo(m.titulo);
      setMontoStr(formatGs(m.metaMonto));
      setDiasStr(String(Math.max(1, m.diasRestantes)));
      setIcono(m.icono);
      setMiembros(m.miembros ?? []);
    }
    setListo(true);
  }, [idParam]);

  const montoNum     = parseGs(montoStr);
  const diasNum      = parseInt(diasStr, 10) || 30;
  const puedeGuardar = titulo.trim().length > 0 && montoNum > 0 && listo;

  const tipoLabel: Record<TipoMeta, string> = {
    solo:  'Solo', grupo: 'Grupo', fijo: 'Fijo', largo: 'Largo plazo',
  };

  function guardar() {
    if (!puedeGuardar || guardando) return;
    setGuardando(true);
    try {
      if (isEdit && idParam) {
        updateMeta(idParam, {
          titulo: titulo.trim(),
          icono,
          metaMonto:     montoNum,
          diasRestantes: diasNum,
        });
      } else {
        insertMeta({
          titulo: titulo.trim(),
          icono,
          tipo,
          metaMonto:     montoNum,
          actualMonto:   0,
          diasRestantes: diasNum,
          esGrupo:       tipo === 'grupo',
          miembros:      tipo === 'grupo' ? miembros : [],
          notifCount:    0,
        });
      }
      router.back();
    } catch (e) {
      console.error(e);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <SafeAreaView style={[s.flex, { backgroundColor: t.bg }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"
              stroke={t.accent} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M18 6L6 18M6 6l12 12" />
            </Svg>
          </TouchableOpacity>
          {!isEdit && (
            <Text style={[s.tipoChip, { backgroundColor: 'rgba(179,106,42,0.12)', color: t.accent }]}>
              {tipoLabel[tipo]}
            </Text>
          )}
          {isEdit && (
            <Text style={[s.tipoChip, { backgroundColor: dark ? 'rgba(63,142,90,0.12)' : 'rgba(63,142,90,0.08)', color: '#3F8E5A' }]}>
              Editando
            </Text>
          )}
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={[s.heading, { color: t.ink }]}>
            {isEdit ? 'Editar meta' : 'Nueva meta'}
          </Text>
          <Text style={[s.sub, { color: t.ink3 }]}>
            {isEdit
              ? 'Modificá el nombre, el monto o los días.'
              : 'Poné un nombre, el monto a alcanzar y cuántos días tenés.'}
          </Text>

          <Text style={[s.label, { color: t.ink3 }]}>Ícono</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
            style={{ marginBottom: 24 }}
          >
            {ICONOS.map(o => (
              <IconoBtn
                key={o.id}
                id={o.id}
                label={o.label}
                emoji={o.emoji}
                selected={icono === o.id}
                onPress={() => setIcono(o.id)}
                t={t}
                accent={t.accent}
              />
            ))}
          </ScrollView>

          <Text style={[s.label, { color: t.ink3 }]}>Nombre de la meta</Text>
          <TextInput
            style={[s.inputLine, { color: t.ink, borderBottomColor: t.hairline, fontFamily: fonts.display }]}
            value={titulo}
            onChangeText={setTitulo}
            placeholder="Ej: Viaje a Encarnación"
            placeholderTextColor={t.ink3}
            autoFocus={!isEdit}
            maxLength={60}
          />

          <Text style={[s.label, { color: t.ink3, marginTop: 22 }]}>Monto objetivo</Text>
          <View style={[s.inputRow, { backgroundColor: t.card, borderColor: t.hairline }]}>
            <Text style={[s.inputPfx, { color: t.ink2 }]}>Gs</Text>
            <TextInput
              style={[s.inputInner, { color: t.ink, fontFamily: fonts.mono }]}
              value={montoStr}
              onChangeText={v => setMontoStr(formatGs(parseGs(v)))}
              placeholder="0"
              placeholderTextColor={t.ink3}
              keyboardType="number-pad"
            />
          </View>

          <Text style={[s.label, { color: t.ink3, marginTop: 16 }]}>Días para alcanzarla</Text>
          <View style={[s.inputRow, { backgroundColor: t.card, borderColor: t.hairline }]}>
            <TextInput
              style={[s.inputInner, { color: t.ink, flex: 1, fontFamily: fonts.mono }]}
              value={diasStr}
              onChangeText={v => setDiasStr(v.replace(/\D/g, ''))}
              placeholder="30"
              placeholderTextColor={t.ink3}
              keyboardType="number-pad"
            />
            <Text style={[s.inputSuffix, { color: t.ink3 }]}>días</Text>
          </View>

          {(tipo === 'grupo' || (isEdit && miembros.length > 0)) && (
            <>
              <Text style={[s.label, { color: t.ink3, marginTop: 20 }]}>Integrantes del grupo</Text>
              <Text style={[s.hint, { color: t.ink3 }]}>
                Agregá el nombre o inicial de cada persona que va a aportar a esta meta. Presioná Enter para confirmar.
              </Text>

              {miembros.length > 0 && (
                <View style={s.chipsRow}>
                  {miembros.map((m, i) => (
                    <TouchableOpacity
                      key={i}
                      style={[s.chip, { backgroundColor: 'rgba(63,142,90,0.1)', borderColor: 'rgba(63,142,90,0.25)' }]}
                      onPress={() => setMiembros(prev => prev.filter((_, idx) => idx !== i))}
                      activeOpacity={0.7}
                    >
                      <View style={[s.avatar, { backgroundColor: ['#3F8E5A', '#B36A2A', '#1F3A8A', '#8B5CF6'][i % 4] }]}>
                        <Text style={s.avatarTxt}>{m[0]?.toUpperCase() ?? '?'}</Text>
                      </View>
                      <Text style={[s.chipTxt, { color: '#3F8E5A' }]}>{m}</Text>
                      <Text style={[s.chipX, { color: '#3F8E5A' }]}>×</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {miembros.length < 8 && (
                <View style={[s.inputRow, { backgroundColor: t.card, borderColor: t.hairline }]}>
                  <TextInput
                    style={[s.inputInner, { color: t.ink, flex: 1, fontFamily: fonts.ui }]}
                    value={miembroStr}
                    onChangeText={setMiembroStr}
                    placeholder="Nombre o inicial..."
                    placeholderTextColor={t.ink3}
                    returnKeyType="done"
                    onSubmitEditing={() => {
                      const v = miembroStr.trim();
                      if (v && !miembros.includes(v)) setMiembros(prev => [...prev, v]);
                      setMiembroStr('');
                    }}
                  />
                  <TouchableOpacity
                    onPress={() => {
                      const v = miembroStr.trim();
                      if (v && !miembros.includes(v)) setMiembros(prev => [...prev, v]);
                      setMiembroStr('');
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={[s.addBtn, { color: '#3F8E5A' }]}>+ Agregar</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </ScrollView>

        <View style={[s.footer, { borderTopColor: t.hairline }]}>
          <TouchableOpacity
            style={[s.btn, { backgroundColor: t.accent },
              (!puedeGuardar || guardando) && { opacity: 0.35 }]}
            onPress={guardar}
            disabled={!puedeGuardar || guardando}
            activeOpacity={0.85}
          >
            <Text style={s.btnTxt}>
              {isEdit ? 'Guardar cambios →' : 'Crear meta →'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 22, paddingTop: 14, paddingBottom: 10,
  },
  tipoChip: {
    fontSize: 11.5, fontWeight: '600', fontFamily: fonts.ui,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
  },
  scroll:  { paddingHorizontal: 22, paddingTop: 4, paddingBottom: 32 },
  heading: {
    fontFamily: fonts.display, fontStyle: 'italic', fontWeight: '400',
    fontSize: 30, lineHeight: 32, letterSpacing: -0.8, marginBottom: 6,
  },
  sub:   { fontSize: 13, lineHeight: 20, fontFamily: fonts.ui, marginBottom: 24 },
  label: {
    fontSize: 10.5, letterSpacing: 1.2, textTransform: 'uppercase',
    fontWeight: '600', fontFamily: fonts.ui, marginBottom: 10,
  },
  inputLine: {
    fontSize: 26, letterSpacing: -0.5, paddingBottom: 10,
    borderBottomWidth: 1.5, fontStyle: 'italic',
  },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: br.md, borderWidth: 1, paddingHorizontal: 16, height: 52,
  },
  inputPfx:    { fontFamily: fonts.display, fontStyle: 'italic', fontSize: 18, color: '#181513' },
  inputInner:  { flex: 1, fontSize: 17, fontWeight: '500', paddingVertical: 0 },
  inputSuffix: { fontSize: 13, fontFamily: fonts.ui },
  hint:     { fontSize: 12, fontFamily: fonts.ui, lineHeight: 18, marginBottom: 12 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 10 },
  chip:     { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1 },
  avatar:   { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontSize: 9, fontWeight: '700', color: '#fff', fontFamily: fonts.ui },
  chipTxt:  { fontSize: 12, fontWeight: '500', fontFamily: fonts.ui },
  chipX:    { fontSize: 14, fontWeight: '400', fontFamily: fonts.ui },
  addBtn:   { fontSize: 13, fontWeight: '500', fontFamily: fonts.ui },
  footer: {
    paddingHorizontal: 22, paddingBottom: 24, paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  btn: {
    height: 52, borderRadius: br.lg,
    alignItems: 'center', justifyContent: 'center',
  },
  btnTxt: { fontSize: 15, fontWeight: '600', color: '#FAF8F4', fontFamily: fonts.ui },
});
