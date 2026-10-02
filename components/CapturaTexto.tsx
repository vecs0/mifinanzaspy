/**
 * CapturaTexto
 * Responsabilidad: Captura por texto libre o voz con vista previa editable y guardado en lote
 * Usado por: QuickAddModal
 * Depende de: nlCapture, database, voiceInput, Icon
 */
import { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { insertTransaccion, getCategorias, getCategoriasOcultas, calcularHashTransaccion, existeTransaccionPorHash } from '@/services/database';
import {
  capturarTexto, mejorarConIA, parsearTextoLocal, aplicarMemoria, aprenderCorreccion,
  duplicadosInternos, limpiarTexto, MAX_TEXTO, type ItemCaptura,
} from '@/services/nlCapture';
import { useVoiceInput } from '@/services/voiceInput';
import { useThemeCtx } from '@/services/ThemeContext';
import { colors, colorsDark } from '@/theme/design-system';
import { BANCO_POR_ID } from '@/constants/banks';
import { CATEGORIA_POR_ID } from '@/constants/categories';
import { Icon } from '@/components/Icon';
import type { CuentaBancaria, Categoria, Transaccion } from '@/types/finance';

interface Props {
  cuentas: CuentaBancaria[];
  cuentaId: string;
  onCuentaChange: (id: string) => void;
  initialTexto?: string;
  onGuardado: () => void;
  onManual: () => void;
}

type Fase = 'idle' | 'cargando' | 'listo' | 'vacio' | 'error' | 'guardando';

interface ItemEditable extends ItemCaptura {
  uid: number;
  categoriaSugerida: string;
  categoriaTocada: boolean;
}

function useStyles(t: typeof colors) {
  return StyleSheet.create({
    input: {
      minHeight: 96, maxHeight: 180, fontSize: 15, color: t.ink, padding: 0,
      textAlignVertical: 'top', flex: 1,
    },
    box: {
      flexDirection: 'row', gap: 10, backgroundColor: t.card, borderRadius: 14,
      padding: 14, borderWidth: 1, borderColor: t.hairline, marginBottom: 12,
    },
    micBtn: {
      width: 36, height: 36, borderRadius: 999, backgroundColor: t.surface,
      alignItems: 'center', justifyContent: 'center',
    },
    primary: { paddingVertical: 14, borderRadius: 14, alignItems: 'center', backgroundColor: t.accent },
    primaryTxt: { fontSize: 14, fontWeight: '700', color: '#fff' },
    secondary: {
      paddingVertical: 12, borderRadius: 14, alignItems: 'center',
      borderWidth: 1, borderColor: t.hairline, backgroundColor: t.card,
    },
    secondaryTxt: { fontSize: 13, fontWeight: '600', color: t.ink2 },
    lbl: {
      fontSize: 10, fontWeight: '600', color: t.muteText,
      textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8,
    },
    item: {
      backgroundColor: t.card, borderRadius: 14, padding: 12,
      borderWidth: 1, borderColor: t.hairline, marginBottom: 10, gap: 8,
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    montoInput: { fontSize: 20, fontWeight: '700', color: t.ink, fontFamily: 'GeistMono', padding: 0, flex: 1 },
    conceptoInput: {
      fontSize: 14, color: t.ink, padding: 8, backgroundColor: t.surface, borderRadius: 8,
    },
    catBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6,
      borderRadius: 999, backgroundColor: t.surface,
    },
    catBtnTxt: { fontSize: 12, color: t.ink2, fontWeight: '500' },
    catChip: {
      flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6,
      borderRadius: 999, borderWidth: 1, borderColor: t.hairline, backgroundColor: t.card,
    },
    tipoBadge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
    tipoTxt: { fontSize: 11, fontWeight: '700' },
    dup: {
      flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6,
      borderRadius: 8, backgroundColor: t.warnBg,
    },
    dupTxt: { fontSize: 11, color: t.warn, flex: 1 },
    msg: { fontSize: 12, color: t.ink3, textAlign: 'center', marginVertical: 12 },
    err: { fontSize: 12, color: t.negative, marginBottom: 10 },
    accChip: {
      width: 54, height: 54, borderRadius: 13, alignItems: 'center', justifyContent: 'center',
      borderWidth: 2, borderColor: 'transparent',
    },
    accChipTxt: { fontSize: 11, fontWeight: '700', color: '#fff', textAlign: 'center' },
  });
}

function MicIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M12 2a3 3 0 00-3 3v6a3 3 0 006 0V5a3 3 0 00-3-3zM19 11a7 7 0 01-14 0M12 19v3" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function TrashIcon({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function categoriasPara(tipo: 'egreso' | 'ingreso'): Categoria[] {
  try {
    const ocultas = getCategoriasOcultas();
    return getCategorias().filter(c => (c.tipo === tipo || c.tipo === 'mixto') && c.id !== 'transferencia' && !ocultas.includes(c.id));
  } catch {
    return [];
  }
}

let contadorUid = 1;

function aEditables(items: ItemCaptura[]): ItemEditable[] {
  return items.map(it => ({ ...it, uid: contadorUid++, categoriaSugerida: it.categoriaId, categoriaTocada: false }));
}

export default function CapturaTexto({ cuentas, cuentaId, onCuentaChange, initialTexto, onGuardado, onManual }: Props) {
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;
  const s = useStyles(t);
  const voice = useVoiceInput();

  const [texto, setTexto] = useState(initialTexto ? limpiarTexto(initialTexto) : '');
  const [items, setItems] = useState<ItemEditable[]>([]);
  const [fase, setFase] = useState<Fase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [origen, setOrigen] = useState<'local' | 'ia' | null>(null);
  const [catAbierta, setCatAbierta] = useState<number | null>(null);
  const [iaUsada, setIaUsada] = useState(false);
  const analisisId = useRef(0);

  const esEfectivo = cuentaId === '';
  const realCuentaId = esEfectivo ? 'efectivo' : (cuentaId || cuentas[0]?.id || 'efectivo');

  useEffect(() => {
    if (!initialTexto) return;
    const limpio = limpiarTexto(initialTexto);
    setTexto(limpio);
    analizarLocal(limpio);
  }, [initialTexto]);

  useEffect(() => {
    if (voice.transcript && !voice.recognizing) setTexto(limpiarTexto(voice.transcript));
  }, [voice.transcript, voice.recognizing]);

  async function analizarLocal(txt: string) {
    const id = ++analisisId.current;
    setFase('cargando'); setError(null); setIaUsada(false);
    try {
      const local = await aplicarMemoria(parsearTextoLocal(txt));
      if (id !== analisisId.current) return;
      setItems(aEditables(local));
      setOrigen('local');
      setFase(local.length > 0 ? 'listo' : 'vacio');
    } catch {
      if (id !== analisisId.current) return;
      setFase('error'); setError('No se pudo analizar el texto');
    }
  }

  async function analizar() {
    const txt = limpiarTexto(texto);
    if (!txt) { setFase('idle'); setError('Escribi o dicta lo que gastaste o cobraste'); return; }
    const id = ++analisisId.current;
    setFase('cargando'); setError(null); setCatAbierta(null);
    try {
      const r = await capturarTexto(txt);
      if (id !== analisisId.current) return;
      setItems(aEditables(r.items));
      setOrigen(r.origen);
      setIaUsada(r.origen === 'ia');
      if (r.items.length > 0) setFase('listo');
      else if (r.error && r.origen === 'ia') { setFase('error'); setError(r.error); }
      else setFase('vacio');
    } catch {
      if (id !== analisisId.current) return;
      setFase('error'); setError('No se pudo analizar el texto');
    }
  }

  async function mejorar() {
    const txt = limpiarTexto(texto);
    if (!txt) return;
    const id = ++analisisId.current;
    setFase('cargando'); setError(null); setCatAbierta(null);
    const r = await mejorarConIA(txt);
    if (id !== analisisId.current) return;
    setIaUsada(true);
    if (r.items.length > 0) {
      setItems(aEditables(await aplicarMemoria(r.items)));
      setOrigen('ia');
      setFase('listo');
    } else {
      setFase(items.length > 0 ? 'listo' : 'error');
      setError(r.error ?? 'La IA no pudo identificar movimientos');
    }
  }

  function actualizar(uid: number, cambios: Partial<ItemEditable>) {
    setItems(prev => prev.map(i => (i.uid === uid ? { ...i, ...cambios } : i)));
  }

  function quitar(uid: number) {
    setItems(prev => {
      const next = prev.filter(i => i.uid !== uid);
      if (next.length === 0) setFase('vacio');
      return next;
    });
  }

  function cambiarTipo(it: ItemEditable) {
    const tipo = it.tipo === 'egreso' ? 'ingreso' : 'egreso';
    const cats = categoriasPara(tipo);
    const categoriaId = cats.some(c => c.id === it.categoriaId) ? it.categoriaId : (tipo === 'ingreso' ? 'salario' : 'otros');
    actualizar(it.uid, { tipo, categoriaId });
  }

  const duplicadosLote = useMemo(() => duplicadosInternos(items), [items]);
  const duplicadosDB = useMemo(() => {
    const set = new Set<number>();
    items.forEach((it, idx) => {
      try {
        const hash = calcularHashTransaccion({
          cuentaId: realCuentaId,
          monto: it.tipo === 'egreso' ? -it.monto : it.monto,
          fecha: it.fecha,
          descripcion: it.concepto,
          smsRaw: null,
        });
        if (existeTransaccionPorHash(hash)) set.add(idx);
      } catch {
        return;
      }
    });
    return set;
  }, [items, realCuentaId]);

  const guardables = items.filter(i => i.monto > 0);
  const total = guardables.reduce((acc, i) => acc + (i.tipo === 'egreso' ? -i.monto : i.monto), 0);

  async function guardar() {
    if (guardables.length === 0 || fase === 'guardando') return;
    setFase('guardando'); setError(null);
    const cuenta = cuentas.find(c => c.id === realCuentaId);
    const bancoId = esEfectivo ? 'efectivo' : (cuenta?.bancoId ?? 'manual');
    const pendientes = [...guardables];
    let guardados = 0;
    try {
      for (const it of guardables) {
        const tx: Omit<Transaccion, 'id'> = {
          cuentaId: realCuentaId, bancoId,
          monto: it.tipo === 'egreso' ? -it.monto : it.monto,
          tipo: it.tipo === 'egreso' ? 'debito' : 'credito',
          categoriaId: it.categoriaId, descripcion: it.concepto.trim(),
          fuente: 'manual', fecha: it.fecha,
          saldoPost: null, smsRaw: null, procesado: true, notas: null, adjunto: null,
        };
        await insertTransaccion(tx);
        guardados++;
        pendientes.shift();
        if (it.categoriaTocada && it.categoriaId !== it.categoriaSugerida) {
          await aprenderCorreccion(it.concepto, it.categoriaId, it.tipo);
        }
      }
      onGuardado();
    } catch {
      const restantes = new Set(pendientes.map(p => p.uid));
      setItems(prev => prev.filter(i => restantes.has(i.uid)));
      setFase('error');
      setError(`Se guardaron ${guardados} de ${guardables.length}. Reintenta con los restantes.`);
    }
  }

  const hayVoz = voice.recognizing;
  const dupTotal = new Set([...duplicadosLote, ...duplicadosDB]).size;

  return (
    <View>
      <Text style={s.lbl}>Contame que registrar</Text>
      <View style={s.box}>
        <TextInput
          style={s.input}
          multiline
          value={hayVoz ? voice.transcript : texto}
          onChangeText={txt => setTexto(txt.slice(0, MAX_TEXTO))}
          placeholder="ej: gaste 25 mil en almuerzo y 12 mil en uber"
          placeholderTextColor={t.muteText}
          editable={!hayVoz}
          maxLength={MAX_TEXTO}
        />
        <TouchableOpacity
          style={[s.micBtn, hayVoz && { backgroundColor: t.negative }]}
          onPress={() => (hayVoz ? voice.stop() : voice.start())}
          accessibilityLabel="Dictar por voz"
        >
          <MicIcon color={hayVoz ? '#fff' : t.ink2} />
        </TouchableOpacity>
      </View>
      {voice.error ? <Text style={s.err}>{voice.error}</Text> : null}

      <TouchableOpacity
        style={[s.primary, (fase === 'cargando' || fase === 'guardando' || !texto.trim()) && { opacity: 0.5 }]}
        onPress={analizar}
        disabled={fase === 'cargando' || fase === 'guardando' || !texto.trim()}
      >
        <Text style={s.primaryTxt}>Analizar</Text>
      </TouchableOpacity>

      <TouchableOpacity style={{ alignItems: 'center', paddingVertical: 12 }} onPress={onManual}>
        <Text style={{ fontSize: 12, color: t.accent, fontWeight: '600' }}>Prefiero el formulario manual</Text>
      </TouchableOpacity>

      {fase === 'cargando' && (
        <View style={{ alignItems: 'center', marginVertical: 14 }}>
          <ActivityIndicator color={t.accent} />
          <Text style={s.msg}>Analizando...</Text>
        </View>
      )}

      {error ? <Text style={s.err}>{error}</Text> : null}

      {fase === 'vacio' && (
        <Text style={s.msg}>No encontre ningun monto. Proba con algo como "gaste 25 mil en almuerzo" o usa IA.</Text>
      )}

      {(fase === 'vacio' || fase === 'listo' || fase === 'error') && texto.trim().length > 0 && !iaUsada && (
        <TouchableOpacity style={[s.secondary, { marginBottom: 14 }]} onPress={mejorar}>
          <Text style={s.secondaryTxt}>Mejorar con IA</Text>
        </TouchableOpacity>
      )}

      {items.length > 0 && (
        <View>
          <Text style={s.lbl}>Vista previa ({items.length}){origen === 'ia' ? ' - IA' : ''}</Text>
          {dupTotal > 0 && (
            <View style={[s.dup, { marginBottom: 10 }]}>
              <Text style={s.dupTxt}>Hay movimientos que parecen repetidos. Revisalos antes de guardar.</Text>
            </View>
          )}
          {items.map((it, idx) => {
            const col = it.tipo === 'egreso' ? t.negative : t.positive;
            const cat = CATEGORIA_POR_ID[it.categoriaId] ?? null;
            const abierta = catAbierta === it.uid;
            const esDupDB = duplicadosDB.has(idx);
            const esDupLote = duplicadosLote.has(idx);
            return (
              <View key={it.uid} style={s.item}>
                <View style={s.row}>
                  <TouchableOpacity
                    onPress={() => cambiarTipo(it)}
                    style={[s.tipoBadge, { backgroundColor: col + '25' }]}
                    accessibilityLabel="Cambiar entre egreso e ingreso"
                  >
                    <Text style={[s.tipoTxt, { color: col }]}>{it.tipo === 'egreso' ? 'Egreso' : 'Ingreso'}</Text>
                  </TouchableOpacity>
                  <Text style={{ fontSize: 14, color: t.ink3 }}>Gs</Text>
                  <TextInput
                    style={s.montoInput}
                    value={String(it.monto || '')}
                    keyboardType="numeric"
                    onChangeText={txt => actualizar(it.uid, { monto: parseInt(txt.replace(/\D/g, '').slice(0, 12), 10) || 0 })}
                  />
                  <TouchableOpacity onPress={() => quitar(it.uid)} accessibilityLabel="Quitar">
                    <TrashIcon color={t.ink3} />
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={s.conceptoInput}
                  value={it.concepto}
                  maxLength={80}
                  onChangeText={txt => actualizar(it.uid, { concepto: txt })}
                  placeholder="Concepto"
                  placeholderTextColor={t.muteText}
                />
                <View style={s.row}>
                  <TouchableOpacity style={s.catBtn} onPress={() => setCatAbierta(abierta ? null : it.uid)}>
                    {cat && <Icon name={cat.icono} size={14} color={cat.tinte} />}
                    <Text style={s.catBtnTxt}>{cat?.nombre ?? it.categoriaId}</Text>
                  </TouchableOpacity>
                  <Text style={{ fontSize: 11, color: t.ink3 }}>{it.fecha}</Text>
                </View>
                {abierta && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                    {categoriasPara(it.tipo).map(c => (
                      <TouchableOpacity
                        key={c.id}
                        style={[s.catChip, c.id === it.categoriaId && { borderColor: col }]}
                        onPress={() => {
                          actualizar(it.uid, { categoriaId: c.id, categoriaTocada: true });
                          setCatAbierta(null);
                        }}
                      >
                        <Icon name={c.icono} size={14} color={c.tinte} />
                        <Text style={s.catBtnTxt}>{c.nombre}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
                {(esDupDB || esDupLote) && (
                  <View style={s.dup}>
                    <Text style={s.dupTxt}>
                      {esDupDB ? 'Ya existe un movimiento igual en esta cuenta y fecha' : 'Repetido en esta lista'}
                    </Text>
                  </View>
                )}
              </View>
            );
          })}

          <Text style={[s.lbl, { marginTop: 6 }]}>Cuenta</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, marginBottom: 14 }}>
            <TouchableOpacity
              style={[s.accChip, { backgroundColor: dark ? '#2C2420' : '#E8E4DE' }, esEfectivo && { borderColor: t.ink }]}
              onPress={() => onCuentaChange('')}
            >
              <Text style={[s.accChipTxt, { color: esEfectivo ? t.ink : t.ink2 }]}>Efectivo</Text>
            </TouchableOpacity>
            {cuentas.map(c => {
              const banco = BANCO_POR_ID[c.bancoId] ?? null;
              const sel = cuentaId === c.id;
              return (
                <TouchableOpacity
                  key={c.id}
                  style={[s.accChip, { backgroundColor: banco?.tinte ?? t.surface }, sel && { borderColor: t.ink }]}
                  onPress={() => onCuentaChange(c.id)}
                >
                  <Text style={s.accChipTxt} numberOfLines={2}>{banco?.corto ?? c.alias}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <TouchableOpacity
            style={[s.primary, (guardables.length === 0 || fase === 'guardando') && { opacity: 0.5 }]}
            onPress={guardar}
            disabled={guardables.length === 0 || fase === 'guardando'}
          >
            <Text style={s.primaryTxt}>
              {fase === 'guardando'
                ? 'Guardando...'
                : `Confirmar y guardar ${guardables.length} (${total < 0 ? '-' : '+'}Gs ${Math.abs(total).toLocaleString('es-PY')})`}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
