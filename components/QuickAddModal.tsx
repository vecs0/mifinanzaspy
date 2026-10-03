/**
 * QuickAddModal
 * Responsabilidad: Modal de registro rapido de transaccion
 * Usado por: app/(tabs)/index.tsx, DeepLinkCaptura
 * Depende de: database, CapturaTexto, CategoryManager, BrandMark, CategoriaChip, Icon
 */
import { useState, useCallback, useEffect } from 'react';
import {
  View, Text, Modal, TouchableOpacity, TextInput,
  ScrollView, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { insertTransaccion, getCategoriasOcultas, getCategorias } from '@/services/database';
import { clasificarSincrono } from '@/services/classifier';

import { BANCO_POR_ID } from '@/constants/banks';
import { Icon } from '@/components/Icon';
import CalendarPicker from '@/components/CalendarPicker';
import CategoryManager from '@/components/CategoryManager';
import CapturaTexto from '@/components/CapturaTexto';
import { useVoiceInput } from '@/services/voiceInput';
import { useThemeCtx } from '@/services/ThemeContext';
import { colors, colorsDark } from '@/theme/design-system';
import type { CuentaBancaria, Transaccion } from '@/types/finance';

const COL_EG = '#e07060';
const COL_IN = '#4db88a';

function tipoColor(tipo: 'egreso' | 'ingreso' | 'transferencia', accent: string): string {
  if (tipo === 'egreso') return COL_EG;
  if (tipo === 'ingreso') return COL_IN;
  return accent;
}

function tipoDarkText(tipo: 'egreso' | 'ingreso' | 'transferencia'): string {
  if (tipo === 'egreso') return '#2a0d08';
  if (tipo === 'ingreso') return '#06281a';
  return '#2a1608';
}

function tipoSelBg(tipo: 'egreso' | 'ingreso' | 'transferencia', accent: string, dark: boolean): string {
  if (dark) {
    if (tipo === 'egreso') return '#241410';
    if (tipo === 'ingreso') return '#0d2218';
    return accent + '20';
  }
  return tipoColor(tipo, accent) + '15';
}

interface Props {
  visible:    boolean;
  cuentas:    CuentaBancaria[];
  onClose:    () => void;
  onGuardado: () => void;
  initialTexto?: string;
}

function useStyles(t: typeof colors) {
  return StyleSheet.create({
    calOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 200,
    },
    calWrapper: {
      position: 'absolute',
      top: '20%',
      left: 16,
      right: 16,
    },
    tipoBtn: {
      flex: 1, paddingVertical: 12, borderRadius: 12,
      borderWidth: 1, borderColor: t.hairline,
      alignItems: 'center', backgroundColor: t.card, gap: 4,
    },
    tipoBtnTxt: { fontSize: 11, fontWeight: '600', color: t.ink2 },
    amtLbl: {
      fontSize: 10, fontWeight: '600', color: t.muteText,
      textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8,
    },
    amtRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
    amtGs: { fontSize: 18, fontWeight: '600', color: t.ink3 },
    amtInput: {
      fontSize: 38, fontWeight: '700', color: t.ink,
      fontFamily: 'GeistMono', padding: 0, flex: 1, letterSpacing: -0.5,
    },
    amtUnderline: { height: 2, borderRadius: 2, marginBottom: 20 },
    fieldLbl: {
      fontSize: 10, fontWeight: '600', color: t.muteText,
      textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8,
    },
    fieldBox: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      backgroundColor: t.card, borderRadius: 12, padding: 13,
      borderWidth: 1, borderColor: t.hairline, marginBottom: 14,
    },
    fieldText: { fontSize: 14, color: t.ink, flex: 1, fontWeight: '500' },
    fieldInput: { fontSize: 14, color: t.ink, flex: 1, padding: 0 },
    micBtn: {
      width: 32, height: 32, borderRadius: 999,
      backgroundColor: t.surface, alignItems: 'center', justifyContent: 'center',
    },
    catHeader: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      marginBottom: 10,
    },
    catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
    catItem: {
      width: '23%', alignItems: 'center', padding: 10, borderRadius: 11,
      backgroundColor: t.card, borderWidth: 1.5, borderColor: 'transparent', gap: 5,
    },
    catNombre: { fontSize: 10, color: t.ink2, textAlign: 'center', lineHeight: 13 },
    accChip: {
      width: 54, height: 54, borderRadius: 13,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 2, borderColor: 'transparent',
    },
    accChipTxt: { fontSize: 11, fontWeight: '700', color: '#fff', textAlign: 'center' },
    accFlow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    accCol: { flex: 1 },
    accColLbl: {
      fontSize: 9, fontWeight: '600', color: t.muteText,
      textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8,
    },
    saveBtn: { paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
    saveBtnTxt: { fontSize: 15, fontWeight: '700' },
  });
}

function MinusIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M5 12h14" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function PlusIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5v14M5 12h14" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function ExchangeIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M17 2l5 5-5 5M3 12h18M7 22l-5-5 5-5M21 12v5a2 2 0 01-2 2H5" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function CalIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2zM3 10h18M8 2v4M16 2v4" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function FileIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function MicIcon({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M12 2a3 3 0 00-3 3v6a3 3 0 006 0V5a3 3 0 00-3-3zM19 11a7 7 0 01-14 0M12 19v3" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ArrowRightIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M5 12h14M12 5l7 7-7 7" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function CloseIcon({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Path d="M18 6L6 18M6 6l12 12" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function catsVisibles() {
  const ocultas = getCategoriasOcultas();
  const todas = getCategorias();
  return {
    egreso:  todas.filter(c => c.tipo === 'egreso'  && !ocultas.includes(c.id)),
    ingreso: todas.filter(c => c.tipo === 'ingreso' && !ocultas.includes(c.id)),
  };
}

function fmtFecha(d: Date): string {
  return d.toLocaleDateString('es-PY', { day: 'numeric', month: 'long', year: 'numeric' });
}

function toDateISO(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function QuickAddModal({ visible, cuentas, onClose, onGuardado, initialTexto }: Props) {
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;
  const s = useStyles(t);

  const voice = useVoiceInput();
  const [tipoTx, setTipoTx] = useState<'egreso' | 'ingreso' | 'transferencia'>('egreso');
  const [monto, setMonto] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [categoriaId, setCategoriaId] = useState('supermercado');
  const [catsEgreso, setCatsEgreso] = useState(catsVisibles().egreso);
  const [catsIngreso, setCatsIngreso] = useState(catsVisibles().ingreso);
  const [cuentaId, setCuentaId] = useState(cuentas[0]?.id ?? '');
  const [cuentaDestinoId, setCuentaDestinoId] = useState(cuentas[1]?.id ?? '');
  const [fecha, setFecha] = useState(new Date());
  const [showCal, setShowCal] = useState(false);
  const [showCatManager, setShowCatManager] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [modo, setModo] = useState<'texto' | 'manual'>('texto');

  const tColor = tipoColor(tipoTx, t.accent);
  const tDark = tipoDarkText(tipoTx);
  const tSelBg = tipoSelBg(tipoTx, t.accent, dark);

  useEffect(() => {
    if (voice.transcript && voice.transcript !== descripcion) setDescripcion(voice.transcript);
  }, [voice.transcript]);

  useEffect(() => {
    if (initialTexto) setModo('texto');
  }, [initialTexto]);

  useEffect(() => {
    if (cuentas.length > 0 && !cuentaId) setCuentaId(cuentas[0].id);
    if (cuentas.length > 1 && !cuentaDestinoId) setCuentaDestinoId(cuentas[1].id);
  }, [cuentas]);

  const cats = tipoTx === 'egreso' ? catsEgreso : catsIngreso;

  function handleDescripcionChange(txt: string) {
    setDescripcion(txt);
    if (txt.length > 3 && tipoTx !== 'transferencia') {
      const autocat = clasificarSincrono(txt, tipoTx === 'ingreso' ? 1 : -1);
      if (autocat !== 'otros' && autocat !== 'salario') setCategoriaId(autocat);
    }
  }

  function handleTipoChange(nuevo: 'egreso' | 'ingreso' | 'transferencia') {
    setTipoTx(nuevo);
    if (nuevo === 'egreso') setCategoriaId('supermercado');
    else if (nuevo === 'ingreso') setCategoriaId('salario');
    else setCategoriaId('transferencia');
  }

  const esEfectivo = cuentaId === '';

  const guardar = useCallback(async () => {
    const montoNum = parseInt(monto.replace(/\D/g, ''), 10);
    if (!montoNum || montoNum <= 0) return;

    const realCuentaId = esEfectivo ? 'efectivo' : (cuentaId || cuentas[0]?.id || '');
    if (!realCuentaId) return;
    const cuenta = cuentas.find(c => c.id === realCuentaId);
    const realBancoId = esEfectivo ? 'efectivo' : (cuenta?.bancoId ?? 'manual');
    const fechaStr = toDateISO(fecha);

    if (tipoTx === 'transferencia') {
      const cuentaDest = cuentas.find(c => c.id === cuentaDestinoId);
      if (!cuentaDest) return;
      const txSalida: Omit<Transaccion, 'id'> = {
        cuentaId: realCuentaId, bancoId: realBancoId,
        monto: -montoNum, tipo: 'debito', categoriaId: 'transferencia',
        descripcion: descripcion.trim() || 'Transferencia a ',
        fuente: 'manual', fecha: fechaStr,
        saldoPost: null, smsRaw: null, procesado: true, notas: null, adjunto: null,
      };
      const txEntrada: Omit<Transaccion, 'id'> = {
        cuentaId: cuentaDestinoId, bancoId: cuentaDest.bancoId ?? 'manual',
        monto: montoNum, tipo: 'credito', categoriaId: 'transferencia',
        descripcion: 'Transferencia de ',
        fuente: 'manual', fecha: fechaStr,
        saldoPost: null, smsRaw: null, procesado: true, notas: null, adjunto: null,
      };
      try {
        await Promise.all([insertTransaccion(txSalida), insertTransaccion(txEntrada)]);
        setMonto(''); setDescripcion(''); setFecha(new Date());
        onGuardado();
      } catch (e) {
        console.error('Error guardando transferencia:', e);
      }
      return;
    }

    const tx: Omit<Transaccion, 'id'> = {
      cuentaId: realCuentaId, bancoId: realBancoId,
      monto: tipoTx === 'egreso' ? -montoNum : montoNum,
      tipo: tipoTx === 'egreso' ? 'debito' : 'credito',
      categoriaId, descripcion: descripcion.trim() || '',
      fuente: 'manual', fecha: fechaStr,
      saldoPost: null, smsRaw: null, procesado: true, notas: null, adjunto: null,
    };

    try {
      await insertTransaccion(tx);
      setMonto(''); setDescripcion(''); setFecha(new Date());
      onGuardado();
    } catch (e) {
      console.error('Error guardando transaccion:', e);
    }
  }, [monto, cuentaId, cuentaDestinoId, categoriaId, descripcion, tipoTx, cuentas, fecha]);

  const montoValido = parseInt(monto.replace(/\D/g, ''), 10) > 0;

  function abrirComprobante() {
    onClose();
    setTimeout(() => router.push('/comprobante' as any), 300);
  }

  function TipoBtn({ tipo, label }: { tipo: 'egreso' | 'ingreso' | 'transferencia'; label: string }) {
    const activo = tipoTx === tipo;
    const col = tipoColor(tipo, t.accent);
    const txtCol = activo ? tipoDarkText(tipo) : t.ink2;
    return (
      <TouchableOpacity
        style={[s.tipoBtn, activo && { backgroundColor: col, borderColor: col }]}
        onPress={() => handleTipoChange(tipo)}
      >
        {tipo === 'egreso'        && <MinusIcon    color={txtCol} />}
        {tipo === 'ingreso'       && <PlusIcon     color={txtCol} />}
        {tipo === 'transferencia' && <ExchangeIcon color={txtCol} />}
        <Text style={[s.tipoBtnTxt, activo && { color: txtCol }]}>{label}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

          <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 4 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: t.ink3 }} />
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 16 }}>
            <Text style={{ fontSize: 19, fontWeight: '700', color: t.ink }}>Agregar movimiento</Text>
            <TouchableOpacity
              style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: t.surface, alignItems: 'center', justifyContent: 'center' }}
              onPress={onClose}
            >
              <CloseIcon color={t.ink2} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
              {(['texto', 'manual'] as const).map(m => (
                <TouchableOpacity
                  key={m}
                  style={[s.tipoBtn, modo === m && { backgroundColor: t.accent, borderColor: t.accent }]}
                  onPress={() => setModo(m)}
                >
                  <Text style={[s.tipoBtnTxt, modo === m && { color: '#fff' }]}>{m === 'texto' ? 'Texto o voz' : 'Formulario'}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {modo === 'texto' ? (
              <CapturaTexto
                cuentas={cuentas}
                cuentaId={cuentaId}
                onCuentaChange={setCuentaId}
                initialTexto={initialTexto}
                onGuardado={onGuardado}
                onManual={() => setModo('manual')}
              />
            ) : (
            <>
            <View style={[{ flexDirection: 'row', gap: 8 }, { marginBottom: 20 }]}>
              <TipoBtn tipo="egreso" label="Egreso" />
              <TipoBtn tipo="ingreso" label="Ingreso" />
              <TipoBtn tipo="transferencia" label="Entre cuentas" />
            </View>

            <Text style={s.amtLbl}>Monto (Gs)</Text>
            <View style={s.amtRow}>
              <Text style={s.amtGs}>Gs</Text>
              <TextInput
                style={s.amtInput}
                value={monto}
                onChangeText={txt => setMonto(txt.replace(/\D/g, ''))}
                placeholder="0"
                placeholderTextColor={t.muteText}
                keyboardType="numeric"
                autoFocus
              />
            </View>
            <View style={[s.amtUnderline, { backgroundColor: tColor }]} />

            <Text style={s.fieldLbl}>Fecha</Text>
            <TouchableOpacity style={s.fieldBox} onPress={() => setShowCal(!showCal)}>
              <CalIcon color={tColor} />
              <Text style={s.fieldText}>{fmtFecha(fecha)}</Text>
              {fecha.toDateString() !== new Date().toDateString() && (
                <View style={{ backgroundColor: tColor + '20', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 }}>
                  <Text style={{ color: tColor, fontSize: 10, fontWeight: '600' }}>Editado</Text>
                </View>
              )}
            </TouchableOpacity>

            <Text style={s.fieldLbl}>
              {'Descripcion' + (tipoTx !== 'transferencia' ? ' (opcional)' : '')}
            </Text>
            <View style={s.fieldBox}>
              <TextInput
                style={s.fieldInput}
                value={voice.recognizing ? voice.transcript : descripcion}
                onChangeText={handleDescripcionChange}
                placeholder={tipoTx === 'transferencia' ? 'ej: Pago a ahorros' : tipoTx === 'ingreso' ? 'ej: Sueldo, venta...' : 'ej: Stock, ANDE...'}
                placeholderTextColor={t.muteText}
                editable={!voice.recognizing}
              />
              <TouchableOpacity
                style={[s.micBtn, voice.recognizing && { backgroundColor: t.negative }]}
                onPress={() => voice.recognizing ? voice.stop() : voice.start()}
              >
                <MicIcon color={voice.recognizing ? '#fff' : t.ink2} />
              </TouchableOpacity>
            </View>
            {voice.error ? (
              <Text style={{ color: t.negative, fontSize: 11, marginBottom: 10, marginTop: -10 }}>{voice.error}</Text>
            ) : null}

            <TouchableOpacity style={s.fieldBox} onPress={abrirComprobante}>
              <FileIcon color={tColor} />
              <Text style={[s.fieldText, { color: t.ink2 }]}>Comprobante</Text>
            </TouchableOpacity>

            {tipoTx !== 'transferencia' && (
              <View style={{ marginBottom: 18 }}>
                <View style={s.catHeader}>
                  <Text style={s.fieldLbl}>Categoria</Text>
                  <TouchableOpacity onPress={() => setShowCatManager(true)}>
                    <Text style={{ fontSize: 12, fontWeight: '500', color: tColor }}>Gestionar</Text>
                  </TouchableOpacity>
                </View>
                <View style={s.catGrid}>
                  {cats.map(cat => {
                    const sel = categoriaId === cat.id;
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        style={[s.catItem, sel && { borderColor: tColor, backgroundColor: tSelBg }]}
                        onPress={() => setCategoriaId(cat.id)}
                      >
                        <Icon name={cat.icono} size={18} color={cat.tinte} />
                        <Text style={[s.catNombre, sel && { color: tColor, fontWeight: '600' }]}>
                          {cat.nombre}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {tipoTx !== 'transferencia' && (
              <View style={{ marginBottom: 20 }}>
                <Text style={[s.fieldLbl, { marginBottom: 10 }]}>Cuenta</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                  <TouchableOpacity
                    style={[s.accChip, { backgroundColor: dark ? '#2C2420' : '#E8E4DE' }, esEfectivo && { borderColor: t.ink }]}
                    onPress={() => setCuentaId('')}
                  >
                    <Text style={[s.accChipTxt, { color: esEfectivo ? t.ink : t.ink2 }]} numberOfLines={2}>Efec-{'\n'}tivo</Text>
                  </TouchableOpacity>
                  {cuentas.map(c => {
                    const banco = BANCO_POR_ID[c.bancoId] ?? null;
                    const sel = cuentaId === c.id;
                    return (
                      <TouchableOpacity
                        key={c.id}
                        style={[s.accChip, { backgroundColor: banco?.tinte ?? t.surface }, sel && { borderColor: t.ink }]}
                        onPress={() => setCuentaId(sel ? '' : c.id)}
                      >
                        <Text style={s.accChipTxt} numberOfLines={2}>{banco?.corto ?? c.alias}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                {esEfectivo && (
                  <View style={{
                    flexDirection: 'row', alignItems: 'center', gap: 6,
                    marginTop: 10, paddingVertical: 7, paddingHorizontal: 10,
                    backgroundColor: dark ? '#1f1a10' : '#fdf3e3',
                    borderRadius: 8, borderWidth: 1,
                    borderColor: dark ? '#3a2e10' : '#e8d8a8',
                  }}>
                    <Svg width={12} height={12} viewBox="0 0 24 24" fill="none"
                      stroke={t.accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <Path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM12 17v-5M12 7h.01" />
                    </Svg>
                    <Text style={{ fontSize: 11, color: dark ? '#c9a84c' : '#8a6a20', flex: 1 }}>
                      Sin cuenta bancaria · el movimiento se registrará como efectivo
                    </Text>
                  </View>
                )}
              </View>
            )}

            {tipoTx === 'transferencia' && (
              <View style={[s.accFlow, { marginBottom: 20 }]}>
                <View style={s.accCol}>
                  <Text style={s.accColLbl}>Origen</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    {cuentas.map(c => {
                      const banco = BANCO_POR_ID[c.bancoId] ?? null;
                      const sel = cuentaId === c.id;
                      return (
                        <TouchableOpacity
                          key={c.id}
                          style={[s.accChip, { backgroundColor: banco?.tinte ?? t.surface }, sel && { borderColor: t.ink }]}
                          onPress={() => setCuentaId(c.id)}
                        >
                          <Text style={s.accChipTxt} numberOfLines={2}>{banco?.corto ?? c.alias}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
                <View style={{ paddingTop: 26 }}>
                  <ArrowRightIcon color={t.ink3} />
                </View>
                <View style={s.accCol}>
                  <Text style={s.accColLbl}>Destino</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    {cuentas.filter(c => c.id !== cuentaId).map(c => {
                      const banco = BANCO_POR_ID[c.bancoId] ?? null;
                      const sel = cuentaDestinoId === c.id;
                      return (
                        <TouchableOpacity
                          key={c.id}
                          style={[s.accChip, { backgroundColor: banco?.tinte ?? t.surface }, sel && { borderColor: t.ink }]}
                          onPress={() => setCuentaDestinoId(c.id)}
                        >
                          <Text style={s.accChipTxt} numberOfLines={2}>{banco?.corto ?? c.alias}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              </View>
            )}

            <TouchableOpacity
              style={[s.saveBtn, { backgroundColor: tColor }, (!montoValido || guardando) && { opacity: 0.5 }]}
              onPress={guardar}
              disabled={!montoValido || guardando}
            >
              <Text style={[s.saveBtnTxt, { color: tDark }]}>
                {guardando ? 'Guardando...' : tipoTx === 'transferencia' ? 'Guardar transferencia' : 'Guardar ' + tipoTx}
              </Text>
            </TouchableOpacity>
            </>
            )}

          </ScrollView>

          {showCal && (
            <View style={s.calOverlay}>
              <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowCal(false)} />
              <View style={s.calWrapper}>
                <CalendarPicker
                  selectedDate={fecha}
                  accentColor={tColor}
                  onConfirm={(data) => {
                    setFecha(new Date(data.year, data.month, data.day));
                    setShowCal(false);
                  }}
                />
              </View>
            </View>
          )}

          <CategoryManager
            visible={showCatManager}
            onClose={() => setShowCatManager(false)}
            onCambio={() => {
              const v = catsVisibles();
              setCatsEgreso(v.egreso);
              setCatsIngreso(v.ingreso);
            }}
          />

        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
