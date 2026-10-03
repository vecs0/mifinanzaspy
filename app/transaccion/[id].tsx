/**
 * transaccion/[id].tsx
 * Responsabilidad: Detalle y edición de una transacción
 * Usado por: historial.tsx, index.tsx (router.push)
 * Depende de: database
 */
import { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Modal, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Svg, { Path, Circle } from 'react-native-svg';
import { getTransacciones, updateTransaccion, deleteTransaccion } from '@/services/database';
import { CATEGORIA_POR_ID } from '@/constants/categories';
import { BANCO_POR_ID } from '@/constants/banks';
import { BankLogo } from '@/components/BankLogo';
import { InlineError } from '@/components/InlineError';
import { Skeleton } from '@/components/Skeleton';
import { useThemeCtx } from '@/services/ThemeContext';
import { localDateKey } from '@/services/dateKeys';
import { colors, colorsDark, borderRadius as br, iconStroke, hit } from '@/theme/design-system';
import type { Transaccion } from '@/types/finance';

const FUENTE_LABEL: Record<string, string> = {
  sms:          'SMS',
  notificacion: 'Notificación',
  manual:       'Manual',
  csv:          'CSV',
  email:        'Email',
};

function fmtGs(n: number): string {
  return Math.abs(n).toLocaleString('es-PY').replace(/,/g, '.');
}

function XIcon() {
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M18 6L6 18M6 6l12 12" stroke={t.ink} strokeWidth={iconStroke} strokeLinecap="round" />
    </Svg>
  );
}

function DotsIcon() {
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="5" r="1.6" fill={t.ink} stroke="none" />
      <Circle cx="12" cy="12" r="1.6" fill={t.ink} stroke="none" />
      <Circle cx="12" cy="19" r="1.6" fill={t.ink} stroke="none" />
    </Svg>
  );
}

export default function TxDetailScreen() {
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;
  const s = useStyles(t);
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [tx, setTx] = useState<Transaccion | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [editDesc, setEditDesc] = useState('');
  const [editMonto, setEditMonto] = useState('');
  const [editFecha, setEditFecha] = useState('');
  const [deleteModal, setDeleteModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  async function cargar() {
    setCargando(true);
    setErrorCarga(null);
    try {
      const todas = await getTransacciones({ limite: 500 });
      setTx(todas.find(x => x.id === id) ?? null);
    } catch (e) {
      console.error('Detalle error:', e);
      setErrorCarga('No pudimos cargar esta transacción.');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => { cargar(); }, [id]);

  function abrirEdit() {
    if (!tx) return;
    setErrorMsg('');
    setEditDesc(tx.descripcion ?? '');
    setEditMonto(String(Math.abs(tx.monto)));
    setEditFecha(localDateKey(new Date(tx.fecha)));
    setMenuOpen(false);
    setEditModal(true);
  }

  async function guardarEdit() {
    if (!tx) return;
    const montoNum = parseInt(editMonto.replace(/[^\d-]/g, ''), 10);
    if (isNaN(montoNum) || montoNum <= 0) { setErrorMsg('Ingresá un monto mayor a cero.'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(editFecha)) { setErrorMsg('La fecha debe tener el formato AAAA-MM-DD.'); return; }
    const montoFinal = tx.monto > 0 ? montoNum : -montoNum;
    try {
      await updateTransaccion(tx.id, { descripcion: editDesc.trim(), monto: montoFinal, fecha: editFecha });
      setTx({ ...tx, descripcion: editDesc.trim(), monto: montoFinal, fecha: editFecha });
      setEditModal(false);
    } catch (e) {
      console.error('Editar error:', e);
      setErrorMsg('No pudimos guardar los cambios. Probá de nuevo.');
    }
  }

  function confirmarEliminar() {
    setMenuOpen(false);
    setDeleteModal(true);
  }

  function ejecutarEliminar() {
    if (!tx) return;
    try {
      deleteTransaccion(tx.id, tx.monto, tx.cuentaId);
      setDeleteModal(false);
      router.back();
    } catch (e) {
      console.error('Eliminar error:', e);
      setDeleteModal(false);
      setErrorCarga('No pudimos eliminar la transacción.');
    }
  }

  if (cargando) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
        <View style={{ padding: 24, gap: 16, alignItems: 'center', marginTop: 48 }} accessibilityLabel="Cargando detalle">
          <Skeleton width={48} height={48} radius={24} />
          <Skeleton width={180} height={18} />
          <Skeleton width={220} height={36} radius={br.md} />
        </View>
      </SafeAreaView>
    );
  }

  if (!tx) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.iconBtn} hitSlop={hit}
            accessibilityRole="button" accessibilityLabel="Cerrar">
            <XIcon />
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
          {errorCarga
            ? <InlineError mensaje={errorCarga} onReintentar={cargar} />
            : <Text style={{ color: t.ink2, textAlign: 'center', fontSize: 15 }}>No encontramos esta transacción. Puede que ya la hayas eliminado.</Text>}
        </View>
      </SafeAreaView>
    );
  }

  const cat       = CATEGORIA_POR_ID[tx.categoriaId];
  const banco     = BANCO_POR_ID[tx.bancoId];
  const esIngreso = tx.monto > 0;
  const esEfectivo = tx.bancoId === 'efectivo' || tx.cuentaId === '__efectivo__' || !banco;
  const fecha = new Date(tx.fecha);

  const filas: [string, string][] = [
    [esEfectivo ? 'Cuenta' : 'Banco', esEfectivo ? 'Efectivo' : (banco?.nombre ?? tx.bancoId)],
    ['Categoría', cat?.nombre ?? tx.categoriaId],
    ['Tipo', esIngreso ? 'Ingreso' : 'Egreso'],
    ['Captura', FUENTE_LABEL[tx.fuente] ?? tx.fuente],
    ['Estado', tx.procesado ? 'Clasificado' : 'Pendiente'],
  ];
  if (tx.saldoPost !== null) filas.push(['Saldo resultante', `Gs ${fmtGs(tx.saldoPost)}`]);
  if (tx.notas) filas.push(['Notas', tx.notas]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={s.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <TouchableOpacity onPress={() => router.back()} style={s.iconBtn} hitSlop={hit}
            accessibilityRole="button" accessibilityLabel="Cerrar">
            <XIcon />
          </TouchableOpacity>
          <Text style={s.headerTitulo} accessibilityRole="header">Detalle</Text>
        </View>
        <TouchableOpacity
          style={s.iconBtn}
          onPress={() => setMenuOpen(!menuOpen)}
          hitSlop={hit}
          accessibilityRole="button"
          accessibilityLabel="Más acciones"
          accessibilityState={{ expanded: menuOpen }}
        >
          <DotsIcon />
        </TouchableOpacity>
      </View>

      {menuOpen && (
        <View style={s.menuDropdown}>
          <TouchableOpacity style={s.menuItem} onPress={abrirEdit} accessibilityRole="button">
            <Text style={s.menuItemText}>Editar transacción</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.menuItem} accessibilityRole="button" onPress={() => {
            setMenuOpen(false);
            router.push(`/(tabs)/chat?consulta=¿Qué opinás de esta transacción? ${tx.descripcion || ''} - Gs ${Math.abs(tx.monto)}` as any);
          }}>
            <Text style={s.menuItemText}>Preguntar al asesor</Text>
          </TouchableOpacity>
          <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.hairline, marginVertical: 4 }} />
          <TouchableOpacity style={s.menuItem} onPress={confirmarEliminar} accessibilityRole="button">
            <Text style={[s.menuItemText, { color: t.negative }]}>Eliminar</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 48 }}>
        {errorCarga && <View style={{ marginBottom: 16 }}><InlineError mensaje={errorCarga} /></View>}

        <View style={s.hero}>
          {esEfectivo ? (
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: t.positiveBg, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: t.positive }}>Gs</Text>
            </View>
          ) : (
            <BankLogo bancoId={tx.bancoId} size={48} />
          )}
          <Text style={s.heroDesc}>{tx.descripcion || cat?.nombre || 'Transacción'}</Text>
          <Text style={[s.heroMonto, { color: esIngreso ? t.positive : t.ink }]} accessibilityLabel={`${esIngreso ? 'Ingreso' : 'Gasto'} de ${fmtGs(tx.monto)} guaraníes`}>
            {esIngreso ? '+' : '−'}Gs {fmtGs(tx.monto)}
          </Text>
          <Text style={s.heroFecha}>
            {fecha.toLocaleDateString('es-PY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            {' · '}{fecha.getHours().toString().padStart(2,'0')}:{fecha.getMinutes().toString().padStart(2,'0')}
          </Text>
        </View>

        <View style={s.lista}>
          {filas.map(([label, valor], i) => (
            <View key={label} style={[s.metaFila, i < filas.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.hairline }]}>
              <Text style={s.metaLabel}>{label}</Text>
              <Text style={[s.metaValor, label === 'Saldo resultante' && { fontFamily: 'GeistMono' }]}>{valor}</Text>
            </View>
          ))}
        </View>

        {tx.smsRaw && (
          <View style={s.sms}>
            <Text style={s.smsLabel}>SMS original</Text>
            <Text style={s.smsTexto}>"{tx.smsRaw}"</Text>
          </View>
        )}
      </ScrollView>

      <Modal visible={editModal} animationType="slide" transparent onRequestClose={() => setEditModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>Editar transacción</Text>

            <Text style={s.modalLabel}>Descripción</Text>
            <TextInput style={s.modalInput} value={editDesc} onChangeText={setEditDesc} maxLength={200} accessibilityLabel="Descripción" />

            <Text style={s.modalLabel}>Monto (Gs)</Text>
            <TextInput style={s.modalInput} value={editMonto} onChangeText={setEditMonto} keyboardType="numeric" maxLength={12} accessibilityLabel="Monto en guaraníes" />

            <Text style={s.modalLabel}>Fecha (AAAA-MM-DD)</Text>
            <TextInput style={s.modalInput} value={editFecha} onChangeText={setEditFecha} maxLength={10} accessibilityLabel="Fecha" />

            {errorMsg ? <View style={{ marginTop: 12 }}><InlineError mensaje={errorMsg} /></View> : null}

            <View style={s.modalBtns}>
              <TouchableOpacity style={s.modalBtnCancel} onPress={() => setEditModal(false)} accessibilityRole="button">
                <Text style={s.modalBtnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.modalBtnSave} onPress={guardarEdit} accessibilityRole="button">
                <Text style={s.modalBtnSaveText}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={deleteModal} animationType="fade" transparent onRequestClose={() => setDeleteModal(false)}>
        <TouchableOpacity style={s.delOverlay} activeOpacity={1} onPress={() => setDeleteModal(false)}>
          <View style={s.delCard}>
            <Text style={s.delTitle}>Eliminar transacción</Text>
            <Text style={s.delDesc} numberOfLines={2}>{tx?.descripcion || 'Esta transacción'}</Text>
            <Text style={s.delMonto}>Gs {fmtGs(tx?.monto ?? 0)}</Text>
            <Text style={s.delAdvertencia}>Esta acción no se puede deshacer.</Text>
            <View style={s.delBtns}>
              <TouchableOpacity style={s.delBtnCancel} onPress={() => setDeleteModal(false)} accessibilityRole="button">
                <Text style={s.delBtnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.delBtnDelete} onPress={ejecutarEliminar} accessibilityRole="button">
                <Text style={s.delBtnDeleteText}>Eliminar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

function useStyles(t: typeof colors) {
  return StyleSheet.create({
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 4,
    },
    headerTitulo: { fontSize: 17, fontWeight: '600', color: t.ink },
    iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    menuDropdown: {
      position: 'absolute',
      top: 52,
      right: 16,
      backgroundColor: t.card,
      borderRadius: br.md,
      padding: 4,
      borderWidth: 1,
      borderColor: t.hairline,
      zIndex: 100,
      shadowColor: t.shadow,
      shadowOpacity: 0.12,
      shadowRadius: 12,
      elevation: 8,
    },
    menuItem: {
      paddingHorizontal: 16,
      minHeight: 44,
      justifyContent: 'center',
      borderRadius: br.sm,
    },
    menuItemText: { fontSize: 14, color: t.ink, fontWeight: '500' },
    hero: { alignItems: 'center', gap: 8, paddingVertical: 24 },
    heroDesc:  { fontSize: 16, fontWeight: '600', color: t.ink, textAlign: 'center', marginTop: 4 },
    heroMonto: {
      fontSize: 36, fontWeight: '700',
      fontFamily: 'GeistMono', letterSpacing: -1, fontVariant: ['tabular-nums'],
    },
    heroFecha: { fontSize: 13, color: t.ink2, textAlign: 'center', textTransform: 'capitalize' },
    lista: { marginBottom: 16 },
    metaFila: {
      flexDirection: 'row', justifyContent: 'space-between',
      alignItems: 'center', paddingVertical: 14, minHeight: 48,
    },
    metaLabel: { fontSize: 14, color: t.ink2 },
    metaValor: { fontSize: 14, fontWeight: '500', color: t.ink, maxWidth: '60%', textAlign: 'right' },
    sms: { backgroundColor: t.surface, borderRadius: br.md, padding: 16, marginBottom: 16 },
    smsLabel: { fontSize: 11, fontWeight: '600', color: t.muteText, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
    smsTexto: { fontSize: 13, color: t.ink2, lineHeight: 20, fontFamily: 'GeistMono' },
    modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: t.scrim },
    modalContent: {
      backgroundColor: t.bg,
      borderTopLeftRadius: br.xl, borderTopRightRadius: br.xl,
      padding: 24, paddingBottom: 40,
    },
    modalTitle: { fontSize: 18, fontWeight: '700', color: t.ink, marginBottom: 16 },
    modalLabel: { fontSize: 12, fontWeight: '600', color: t.muteText, marginBottom: 8, marginTop: 12 },
    modalInput: {
      backgroundColor: t.card, borderRadius: br.md,
      paddingHorizontal: 16, minHeight: 48,
      fontSize: 15, color: t.ink,
      borderWidth: 1, borderColor: t.hairline,
    },
    modalBtns: { flexDirection: 'row', gap: 12, marginTop: 24 },
    modalBtnCancel: {
      flex: 1, minHeight: 52, borderRadius: br.md,
      backgroundColor: t.surface,
      alignItems: 'center', justifyContent: 'center',
    },
    modalBtnCancelText: { fontSize: 15, fontWeight: '600', color: t.ink },
    modalBtnSave: {
      flex: 1, minHeight: 52, borderRadius: br.md,
      backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center',
    },
    modalBtnSaveText: { fontSize: 15, fontWeight: '600', color: t.onAccent },
    delOverlay: {
      flex: 1, justifyContent: 'center', alignItems: 'center',
      backgroundColor: t.scrim,
      padding: 32,
    },
    delCard: {
      width: '100%', maxWidth: 320,
      backgroundColor: t.card,
      borderRadius: br.xl,
      padding: 24,
      alignItems: 'center',
    },
    delTitle: { fontSize: 18, fontWeight: '700', color: t.ink, marginBottom: 8 },
    delDesc: { fontSize: 14, color: t.ink2, textAlign: 'center', lineHeight: 20, marginBottom: 4 },
    delMonto: {
      fontSize: 22, fontWeight: '700', fontFamily: 'GeistMono',
      color: t.ink, letterSpacing: -0.5, marginBottom: 12, fontVariant: ['tabular-nums'],
    },
    delAdvertencia: { fontSize: 13, color: t.ink2, marginBottom: 24 },
    delBtns: { flexDirection: 'row', gap: 12, width: '100%' },
    delBtnCancel: {
      flex: 1, minHeight: 48, borderRadius: br.md,
      backgroundColor: t.surface,
      alignItems: 'center', justifyContent: 'center',
    },
    delBtnCancelText: { fontSize: 15, fontWeight: '600', color: t.ink },
    delBtnDelete: {
      flex: 1, minHeight: 48, borderRadius: br.md,
      backgroundColor: t.negative,
      alignItems: 'center', justifyContent: 'center',
    },
    delBtnDeleteText: { fontSize: 15, fontWeight: '600', color: t.onAccent },
  });
}
