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
import Svg, { Path } from 'react-native-svg';
import { Icon } from '@/components/Icon';
import { InlineError } from '@/components/InlineError';
import { useThemeCtx } from '@/services/ThemeContext';
import { colors, colorsDark, fonts, borderRadius as br, iconStroke, hit } from '@/theme/design-system';
import { insertMeta, getMeta, updateMeta, type TipoMeta } from '@/services/metas';

function parseGs(v: string): number {
  return parseInt(v.replace(/\D/g, ''), 10) || 0;
}

function formatGs(n: number): string {
  if (n === 0) return '';
  return n.toLocaleString('es-PY').replace(/,/g, '.');
}

const ICONOS = [
  { id: 'home',        label: 'Hogar' },
  { id: 'briefcase',   label: 'Trabajo' },
  { id: 'shield',      label: 'Urgencia' },
  { id: 'credit-card', label: 'Deuda' },
  { id: 'trend-up',    label: 'Inversión' },
  { id: 'sparkles',    label: 'Otro' },
];

function IconoBtn({ id, label, selected, onPress, t }: {
  id: string; label: string; selected: boolean;
  onPress: () => void; t: typeof colors;
}) {
  return (
    <TouchableOpacity
      style={[ib.btn,
        { backgroundColor: selected ? t.accentBg : 'transparent', borderColor: selected ? t.accent : t.hairline },
      ]}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`Ícono ${label}`}
    >
      <Icon name={id} size={22} color={selected ? t.accent : t.ink2} />
      <Text style={[ib.label, { color: selected ? t.accent : t.ink2 }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const ib = StyleSheet.create({
  btn:   { width: 76, minHeight: 64, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: br.md, borderWidth: 1, gap: 4 },
  label: { fontSize: 11, fontFamily: fonts.ui, fontWeight: '500' },
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
  const [error,       setError]       = useState<string | null>(null);

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
    setError(null);
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
      setError('No pudimos guardar la meta. Revisá los datos y probá de nuevo.');
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
            hitSlop={hit}
            style={s.closeBtn}
            accessibilityRole="button"
            accessibilityLabel="Cerrar">
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none"
              stroke={t.ink} strokeWidth={iconStroke} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M18 6L6 18M6 6l12 12" />
            </Svg>
          </TouchableOpacity>
          {!isEdit && (
            <Text style={[s.tipoChip, { backgroundColor: t.accentBg, color: t.accent }]}>
              {tipoLabel[tipo]}
            </Text>
          )}
          {isEdit && (
            <Text style={[s.tipoChip, { backgroundColor: t.positiveBg, color: t.positive }]}>
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
          <Text style={[s.sub, { color: t.ink2 }]}>
            {isEdit
              ? 'Modificá el nombre, el monto o los días.'
              : 'Poné un nombre, el monto a alcanzar y cuántos días tenés.'}
          </Text>

          <Text style={[s.label, { color: t.muteText }]}>Ícono</Text>
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
                selected={icono === o.id}
                onPress={() => setIcono(o.id)}
                t={t}
              />
            ))}
          </ScrollView>

          <Text style={[s.label, { color: t.muteText }]}>Nombre de la meta</Text>
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
                      style={[s.chip, { backgroundColor: t.positiveBg, borderColor: t.hairline }]}
                      onPress={() => setMiembros(prev => prev.filter((_, idx) => idx !== i))}
                      activeOpacity={0.7}
                    >
                      <View style={[s.avatar, { backgroundColor: [t.positive, t.accent, t.muted, t.warn][i % 4] }]}>
                        <Text style={[s.avatarTxt, { color: t.onAccent }]}>{m[0]?.toUpperCase() ?? '?'}</Text>
                      </View>
                      <Text style={[s.chipTxt, { color: t.positive }]}>{m}</Text>
                      <Text style={[s.chipX, { color: t.positive }]}>×</Text>
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
                    hitSlop={hit}
                    accessibilityRole="button"
                    accessibilityLabel="Agregar integrante"
                    style={{ minHeight: 44, justifyContent: 'center' }}
                  >
                    <Text style={[s.addBtn, { color: t.accent }]}>+ Agregar</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </ScrollView>

        <View style={[s.footer, { borderTopColor: t.hairline }]}>
          {error && <View style={{ marginBottom: 12 }}><InlineError mensaje={error} onReintentar={guardar} /></View>}
          <TouchableOpacity
            style={[s.btn, { backgroundColor: t.accent },
              (!puedeGuardar || guardando) && { opacity: 0.35 }]}
            onPress={guardar}
            disabled={!puedeGuardar || guardando}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityState={{ disabled: !puedeGuardar || guardando }}
          >
            <Text style={[s.btnTxt, { color: t.onAccent }]}>
              {isEdit ? 'Guardar cambios' : 'Crear meta'}
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
  closeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -12 },
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
    fontSize: 11, letterSpacing: 1.1, textTransform: 'uppercase',
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
  inputPfx:    { fontFamily: fonts.display, fontStyle: 'italic', fontSize: 18 },
  inputInner:  { flex: 1, fontSize: 17, fontWeight: '500', paddingVertical: 0 },
  inputSuffix: { fontSize: 13, fontFamily: fonts.ui },
  hint:     { fontSize: 12, fontFamily: fonts.ui, lineHeight: 18, marginBottom: 12 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 10 },
  chip:     { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1 },
  avatar:   { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontSize: 10, fontWeight: '700', fontFamily: fonts.ui },
  chipTxt:  { fontSize: 12, fontWeight: '500', fontFamily: fonts.ui },
  chipX:    { fontSize: 14, fontWeight: '400', fontFamily: fonts.ui },
  addBtn:   { fontSize: 13, fontWeight: '500', fontFamily: fonts.ui },
  footer: {
    paddingHorizontal: 22, paddingBottom: 24, paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  btn: {
    minHeight: 52, borderRadius: br.lg,
    alignItems: 'center', justifyContent: 'center',
  },
  btnTxt: { fontSize: 16, fontWeight: '600', fontFamily: fonts.ui },
});
