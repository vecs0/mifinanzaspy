/**
 * transaccion/[id].tsx
 * Responsabilidad: Detalle y edición de una transacción
 * Usado por: historial.tsx, index.tsx (router.push)
 * Depende de: database
 */
import { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Modal, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Svg, { Path, Circle } from 'react-native-svg';
import { getTransacciones, updateTransaccion, deleteTransaccion } from '@/services/database';
import { CATEGORIA_POR_ID } from '@/constants/categories';
import { BANCO_POR_ID } from '@/constants/banks';
import { BankLogo } from '@/components/BankLogo';
import { Icon } from '@/components/Icon';
import { useThemeCtx } from '@/services/ThemeContext';
import { colors, colorsDark } from '@/theme/design-system';
import type { Transaccion } from '@/types/finance';

const FUENTE_LABEL: Record<string, string> = {
  sms:          'SMS',
  notificacion: 'Notificación',
  manual:       'Manual',
  csv:          'CSV',
  email:        'Email',
};

function XIcon() {
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;
  return (
    <Svg width={14} height={14} viewBox="0 0 16 16" fill="none">
      <Path d="M4 4l8 8M12 4l-8 8" stroke={t.muteText} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

function DotsIcon() {
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="5" r="1.5" fill={t.ink} stroke="none" />
      <Circle cx="12" cy="12" r="1.5" fill={t.ink} stroke="none" />
      <Circle cx="12" cy="19" r="1.5" fill={t.ink} stroke="none" />
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [editDesc, setEditDesc] = useState('');
  const [editMonto, setEditMonto] = useState('');
  const [editFecha, setEditFecha] = useState('');
  const [deleteModal, setDeleteModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    async function cargar() {
      const todas = await getTransacciones({ limite: 500 });
      const found = todas.find(t => t.id === id);
      setTx(found ?? null);
      setCargando(false);
    }
    cargar();
  }, [id]);

  function abrirEdit() {
    if (!tx) return;
    setErrorMsg('');
    setEditDesc(tx.descripcion ?? '');
    setEditMonto(String(Math.abs(tx.monto)));
    setEditFecha(tx.fecha.slice(0, 10));
    setMenuOpen(false);
    setEditModal(true);
  }

  async function guardarEdit() {
    if (!tx) return;
    const montoNum = parseInt(editMonto.replace(/[^\d-]/g, ''), 10);
    if (isNaN(montoNum) || montoNum <= 0) { setErrorMsg('Monto inválido'); return; }
    const montoFinal = tx.monto > 0 ? montoNum : -montoNum;
    await updateTransaccion(tx.id, { descripcion: editDesc.trim(), monto: montoFinal, fecha: editFecha });
    setTx({ ...tx, descripcion: editDesc.trim(), monto: montoFinal, fecha: editFecha });
    setEditModal(false);
  }

  function confirmarEliminar() {
    setMenuOpen(false);
    setDeleteModal(true);
  }

  function ejecutarEliminar() {
    if (!tx) return;
    deleteTransaccion(tx.id, tx.monto, tx.cuentaId);
    setDeleteModal(false);
    router.back();
  }

  if (cargando) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={t.accent} />
      </SafeAreaView>
    );
  }

  if (!tx) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.btnBack}>
            <XIcon />
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: t.muteText }}>Transacción no encontrada</Text>
        </View>
      </SafeAreaView>
    );
  }

  const cat       = CATEGORIA_POR_ID[tx.categoriaId];
  const banco     = BANCO_POR_ID[tx.bancoId];
  const esIngreso = tx.monto > 0;
  const esEfectivo = tx.bancoId === 'efectivo' || tx.cuentaId === '__efectivo__' || !banco;
  const fecha = new Date(tx.fecha);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      {/* Handle */}
      <View style={{ alignItems: 'center', paddingTop: 10 }}>
        <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(24,21,19,0.15)' }} />
      </View>

      {/* Header */}
      <View style={s.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <TouchableOpacity onPress={() => router.back()} style={s.btnBack}>
            <XIcon />
          </TouchableOpacity>
          <Text style={s.headerTitulo}>Detalle</Text>
        </View>
        <TouchableOpacity
          style={s.menuBtn}
          onPress={() => setMenuOpen(!menuOpen)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <DotsIcon />
        </TouchableOpacity>
      </View>

      {/* Menú desplegable */}
      {menuOpen && (
        <View style={s.menuDropdown}>
          <TouchableOpacity style={s.menuItem} onPress={abrirEdit}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={t.ink} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                <Path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </Svg>
              <Text style={s.menuItemText}>Editar transacción</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={s.menuItem} onPress={() => {
            setMenuOpen(false);
            router.push(`/(tabs)/chat?consulta=¿Qué opinás de esta transacción? ${tx.descripcion || ''} - Gs ${Math.abs(tx.monto)}` as any);
          }}>
            <Text style={s.menuItemText}>Asesor IA</Text>
          </TouchableOpacity>
          <View style={{ height: 1, backgroundColor: 'rgba(24,21,19,0.06)', marginVertical: 4 }} />
          <TouchableOpacity style={s.menuItem} onPress={confirmarEliminar}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#A8401F" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
              </Svg>
              <Text style={[s.menuItemText, { color: '#A8401F' }]}>Eliminar</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: 40 }}>
        {/* Hero */}
        <View style={s.heroCard}>
          {esEfectivo ? (
            <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: dark ? '#0d2218' : '#d8f0e6', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: dark ? '#4db88a' : '#2d7a56' }}>Gs</Text>
            </View>
          ) : (
            <BankLogo bancoId={tx.bancoId} size={48} />
          )}
          <Text style={s.heroDesc}>{tx.descripcion || cat?.nombre || 'Transacción'}</Text>
          <Text style={[s.heroMonto, { color: esIngreso ? t.positive : t.ink }]}>
            {esIngreso ? '+' : '−'}Gs {Math.abs(tx.monto).toLocaleString('es-PY').replace(/,/g, '.')}
          </Text>
          <Text style={s.heroFecha}>
            {fecha.toLocaleDateString('es-PY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            {' · '}{fecha.getHours().toString().padStart(2,'0')}:{fecha.getMinutes().toString().padStart(2,'0')}
          </Text>
          <View style={[s.fuenteBadge, { backgroundColor: esIngreso ? `${t.positive}15` : `${t.accent}15` }]}>
            <Text style={{ fontSize: 10, fontWeight: '600', color: esIngreso ? t.positive : t.accent }}>
              {FUENTE_LABEL[tx.fuente] ?? tx.fuente}
            </Text>
          </View>
        </View>

        {/* Metadata */}
        <View style={s.metaCard}>
          {[
            [esEfectivo ? 'Cuenta' : 'Banco', esEfectivo ? 'Efectivo' : (banco?.nombre ?? tx.bancoId)],
            ['Categoría', cat?.nombre ?? tx.categoriaId],
            ['Tipo', esIngreso ? 'Ingreso' : 'Egreso'],
            ['Captura', FUENTE_LABEL[tx.fuente] ?? tx.fuente],
            ['Estado', tx.procesado ? 'Clasificado' : 'Pendiente'],
          ].map(([label, valor]) => (
            <View key={label} style={s.metaFila}>
              <Text style={s.metaLabel}>{label}</Text>
              <Text style={s.metaValor}>{valor}</Text>
            </View>
          ))}
          {tx.saldoPost !== null && (
            <View style={s.metaFila}>
              <Text style={s.metaLabel}>Saldo resultante</Text>
              <Text style={[s.metaValor, { fontFamily: 'GeistMono' }]}>
                Gs {tx.saldoPost.toLocaleString('es-PY').replace(/,/g, '.')}
              </Text>
            </View>
          )}
          {tx.notas && (
            <View style={s.metaFila}>
              <Text style={s.metaLabel}>Notas</Text>
              <Text style={s.metaValor}>{tx.notas}</Text>
            </View>
          )}
        </View>

        {/* SMS original */}
        {tx.smsRaw && (
          <View style={s.smsCard}>
            <Text style={s.smsLabel}>SMS original</Text>
            <Text style={s.smsTexto}>"{tx.smsRaw}"</Text>
          </View>
        )}

        {/* Preguntar al asesor */}
        <TouchableOpacity
          style={s.asesorBtn}
          onPress={() => router.push(`/(tabs)/chat` as any)}
        >
          <Icon name="chart" size={18} color={t.bg} />
          <Text style={s.asesorBtnText}>Preguntar al asesor IA</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Modal editar */}
      <Modal visible={editModal} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>Editar transacción</Text>

            <Text style={s.modalLabel}>Descripción</Text>
            <TextInput style={s.modalInput} value={editDesc} onChangeText={setEditDesc} maxLength={200} />

            <Text style={s.modalLabel}>Monto (Gs)</Text>
            <TextInput style={s.modalInput} value={editMonto} onChangeText={setEditMonto} keyboardType="numeric" maxLength={12} />

            <Text style={s.modalLabel}>Fecha (YYYY-MM-DD)</Text>
            <TextInput style={s.modalInput} value={editFecha} onChangeText={setEditFecha} maxLength={10} />

            {errorMsg ? <Text style={s.modalError}>{errorMsg}</Text> : null}

            <View style={s.modalBtns}>
              <TouchableOpacity style={s.modalBtnCancel} onPress={() => setEditModal(false)}>
                <Text style={s.modalBtnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.modalBtnSave} onPress={guardarEdit}>
                <Text style={s.modalBtnSaveText}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal eliminar */}
      <Modal visible={deleteModal} animationType="fade" transparent>
        <TouchableOpacity style={s.delOverlay} activeOpacity={1} onPress={() => setDeleteModal(false)}>
          <View style={s.delCard}>
            <View style={s.delIconWrap}>
              <Svg width={28} height={28} viewBox="0 0 24 24">
                <Path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6" fill="none" stroke="#A8401F" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
            <Text style={s.delTitle}>Eliminar transacción</Text>
            <Text style={s.delDesc} numberOfLines={2}>{tx?.descripcion || 'Esta transacción'}</Text>
            <Text style={s.delMonto}>
              Gs {Math.abs(tx?.monto ?? 0).toLocaleString('es-PY').replace(/,/g, '.')}
            </Text>
            <Text style={s.delAdvertencia}>Esta acción no se puede deshacer.</Text>
            <View style={s.delBtns}>
              <TouchableOpacity style={s.delBtnCancel} onPress={() => setDeleteModal(false)}>
                <Text style={s.delBtnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.delBtnDelete} onPress={ejecutarEliminar}>
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
    paddingHorizontal: 22,
    paddingVertical: 10,
  },
  headerTitulo: { fontSize: 17, fontWeight: '600', color: t.ink },
  btnBack: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(24,21,19,0.07)',
    alignItems: 'center', justifyContent: 'center',
  },
  btnBackTexto: { fontSize: 14, color: t.muteText },
  menuBtn: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  menuDropdown: {
    position: 'absolute',
    top: 56,
    right: 16,
    backgroundColor: t.card,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(24,21,19,0.08)',
    zIndex: 100,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  menuItem: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  menuItemText: { fontSize: 13.5, color: t.ink, fontWeight: '500' },
  heroCard: {
    alignItems: 'center', gap: 10,
    padding: 28, marginBottom: 14,
    backgroundColor: t.card,
    borderRadius: 16, borderWidth: 1, borderColor: t.hairline,
  },
  heroDesc:  { fontSize: 16, fontWeight: '600', color: t.ink, textAlign: 'center' },
  heroMonto: {
    fontSize: 30, fontWeight: '800',
    fontFamily: 'GeistMono', letterSpacing: -0.8,
  },
  heroFecha: { fontSize: 12.5, color: t.muteText, textAlign: 'center', textTransform: 'capitalize' },
  fuenteBadge: {
    paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: 8,
  },
  metaCard: {
    backgroundColor: t.card, borderRadius: 14,
    borderWidth: 1, borderColor: t.hairline,
    marginBottom: 14, overflow: 'hidden',
  },
  metaFila: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: t.hairline,
  },
  metaLabel: { fontSize: 13, color: t.muteText },
  metaValor: { fontSize: 13.5, fontWeight: '500', color: t.ink, maxWidth: '60%', textAlign: 'right' },
  smsCard: {
    backgroundColor: 'rgba(24,21,19,0.03)', borderRadius: 12,
    borderWidth: 1, borderColor: t.hairline,
    padding: 14, marginBottom: 14,
  },
  smsLabel: { fontSize: 11, fontWeight: '600', color: t.muteText, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  smsTexto: { fontSize: 13, color: t.ink2, lineHeight: 20, fontFamily: 'GeistMono' },
  asesorBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 12,
    backgroundColor: t.accent, marginTop: 14,
  },
  asesorBtnText: { fontSize: 14, fontWeight: '600', color: '#FAF8F4' },
  modalOverlay: {
    flex: 1, justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalContent: {
    backgroundColor: t.bg,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, paddingBottom: 40,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: t.ink, marginBottom: 20 },
  modalLabel: { fontSize: 12, fontWeight: '600', color: t.muteText, marginBottom: 6, marginTop: 12 },
  modalInput: {
    backgroundColor: t.card, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: t.ink,
    borderWidth: 1, borderColor: 'rgba(24,21,19,0.08)',
  },
  modalError: { fontSize: 12, color: '#A8401F', marginTop: 8, fontWeight: '500' },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 24 },
  modalBtnCancel: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    backgroundColor: 'rgba(24,21,19,0.07)',
    alignItems: 'center',
  },
  modalBtnCancelText: { fontSize: 14, fontWeight: '600', color: t.ink },
  modalBtnSave: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    backgroundColor: t.accent, alignItems: 'center',
  },
  modalBtnSaveText: { fontSize: 14, fontWeight: '600', color: '#FAF8F4' },
  delOverlay: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    padding: 32,
  },
  delCard: {
    width: '100%', maxWidth: 320,
    backgroundColor: t.card,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
  },
  delIconWrap: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#FDF0EE',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  delTitle: { fontSize: 17, fontWeight: '700', color: t.ink, marginBottom: 8 },
  delDesc: { fontSize: 14, color: t.ink2, textAlign: 'center', lineHeight: 20, marginBottom: 4 },
  delMonto: {
    fontSize: 20, fontWeight: '700', fontFamily: 'GeistMono',
    color: t.ink, letterSpacing: -0.5, marginBottom: 12,
  },
  delAdvertencia: { fontSize: 12, color: t.muteText, marginBottom: 20 },
  delBtns: { flexDirection: 'row', gap: 10, width: '100%' },
  delBtnCancel: {
    flex: 1, paddingVertical: 13, borderRadius: 12,
    backgroundColor: 'rgba(24,21,19,0.06)',
    alignItems: 'center',
  },
  delBtnCancelText: { fontSize: 14, fontWeight: '600', color: t.ink },
  delBtnDelete: {
    flex: 1, paddingVertical: 13, borderRadius: 12,
    backgroundColor: '#A8401F',
    alignItems: 'center',
  },
  delBtnDeleteText: { fontSize: 14, fontWeight: '600', color: '#FAF8F4' },
});
}
