// app/transaccion/[id].tsx — Detalle de transacción (modal)
import { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getTransacciones, updateCategoria } from '@/services/database';
import { CATEGORIA_POR_ID, CATEGORIAS } from '@/constants/categories';
import { BANCO_POR_ID } from '@/constants/banks';
import { aprenderRegla } from '@/services/classifier';
import type { Transaccion } from '@/types/finance';

const C = {
  bg:     '#FAF8F4',
  ink:    '#181513',
  accent: '#B36A2A',
  muted:  '#9B8E84',
  border: 'rgba(24,21,19,0.07)',
};

const FUENTE_LABEL: Record<string, string> = {
  sms:          'SMS automático',
  notificacion: 'Notificación push',
  manual:       'Entrada manual',
  csv:          'Importación CSV',
  email:        'Email bancario',
};

function getCatEmoji(catId: string): string {
  const map: Record<string, string> = {
    salario:'💼', honorarios:'📋', venta:'🏷️', intereses:'📈',
    transferencia:'↔️', inversion:'📊', supermercado:'🛒',
    restaurante:'🍽️', combustible:'⛽', transporte:'🚗',
    servicios:'⚡', telefono:'📱', farmacia:'💊', ropa:'👕',
    hogar:'🏠', ocio:'🎵', retiro:'💵', deuda:'💳',
    educacion:'📚', salud:'❤️', otros:'•',
  };
  return map[catId] ?? '•';
}

export default function TxDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [tx, setTx] = useState<Transaccion | null>(null);
  const [cargando, setCargando] = useState(true);
  const [cambiandoCat, setCambiandoCat] = useState(false);

  useEffect(() => {
    async function cargar() {
      // Filtramos por ID sobre las últimas 500 transacciones
      const todas = await getTransacciones({ limite: 500 });
      const found = todas.find(t => t.id === id);
      setTx(found ?? null);
      setCargando(false);
    }
    cargar();
  }, [id]);

  async function cambiarCategoria(nuevaCatId: string) {
    if (!tx) return;
    setCambiandoCat(true);
    try {
      await updateCategoria(tx.id, nuevaCatId);
      if (tx.descripcion) {
        await aprenderRegla(tx.descripcion, nuevaCatId);
      }
      setTx({ ...tx, categoriaId: nuevaCatId });
    } finally {
      setCambiandoCat(false);
    }
  }

  if (cargando) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={C.accent} />
      </SafeAreaView>
    );
  }

  if (!tx) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.btnBack}>
            <Text style={s.btnBackTexto}>✕</Text>
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: C.muted }}>Transacción no encontrada</Text>
        </View>
      </SafeAreaView>
    );
  }

  const cat   = CATEGORIA_POR_ID[tx.categoriaId];
  const banco = BANCO_POR_ID[tx.bancoId];
  const esIngreso = tx.monto > 0;
  const fecha = new Date(tx.fecha);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Handle */}
      <View style={{ alignItems: 'center', paddingTop: 10 }}>
        <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(24,21,19,0.15)' }} />
      </View>

      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitulo}>Detalle</Text>
        <TouchableOpacity onPress={() => router.back()} style={s.btnBack}>
          <Text style={s.btnBackTexto}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: 40 }}>
        {/* Hero — monto */}
        <View style={s.heroCard}>
          <View style={[s.catIconoBig, { backgroundColor: `${cat?.tinte ?? '#6B7280'}18` }]}>
            <Text style={{ fontSize: 32 }}>{getCatEmoji(tx.categoriaId)}</Text>
          </View>
          <Text style={s.heroDesc}>{tx.descripcion || cat?.nombre || 'Transacción'}</Text>
          <Text style={[s.heroMonto, { color: esIngreso ? '#3F8E5A' : C.ink }]}>
            {esIngreso ? '+' : '−'}Gs {Math.abs(tx.monto).toLocaleString('es-PY')}
          </Text>
          <Text style={s.heroFecha}>
            {fecha.toLocaleDateString('es-PY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            {' · '}{fecha.getHours().toString().padStart(2,'0')}:{fecha.getMinutes().toString().padStart(2,'0')}
          </Text>
        </View>

        {/* Metadata */}
        <View style={s.metaCard}>
          {[
            ['Banco / Billetera', banco?.nombre ?? tx.bancoId],
            ['Categoría', `${getCatEmoji(tx.categoriaId)} ${cat?.nombre ?? tx.categoriaId}`],
            ['Origen de captura', FUENTE_LABEL[tx.fuente] ?? tx.fuente],
            ['Estado', tx.procesado ? '✓ Clasificado' : '⏳ Pendiente de revisión'],
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
                Gs {tx.saldoPost.toLocaleString('es-PY')}
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
            <Text style={s.smsLabel}>SMS original capturado</Text>
            <Text style={s.smsTexto}>"{tx.smsRaw}"</Text>
          </View>
        )}

        {/* Cambiar categoría */}
        <View style={{ marginTop: 6 }}>
          <Text style={s.seccionLabel}>Cambiar categoría</Text>
          <View style={s.catGrid}>
            {CATEGORIAS.filter(c => c.tipo !== 'mixto').map(c => {
              const activa = c.id === tx.categoriaId;
              return (
                <TouchableOpacity
                  key={c.id}
                  style={[s.catChip, activa && { backgroundColor: `${c.tinte}18`, borderColor: c.tinte }]}
                  onPress={() => cambiarCategoria(c.id)}
                  disabled={cambiandoCat}
                >
                  <Text style={{ fontSize: 14 }}>{getCatEmoji(c.id)}</Text>
                  <Text style={[s.catChipTexto, activa && { color: c.tinte, fontWeight: '600' }]}>
                    {c.nombre}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingVertical: 10,
  },
  headerTitulo: { fontSize: 17, fontWeight: '600', color: C.ink },
  btnBack: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(24,21,19,0.07)',
    alignItems: 'center', justifyContent: 'center',
  },
  btnBackTexto: { fontSize: 14, color: C.muted },
  heroCard: {
    alignItems: 'center', gap: 10,
    padding: 28, marginBottom: 14,
    backgroundColor: '#fff',
    borderRadius: 16, borderWidth: 1, borderColor: C.border,
  },
  catIconoBig: {
    width: 64, height: 64, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  heroDesc:  { fontSize: 16, fontWeight: '600', color: C.ink, textAlign: 'center' },
  heroMonto: {
    fontSize: 30, fontWeight: '800',
    fontFamily: 'GeistMono', letterSpacing: -0.8,
  },
  heroFecha: { fontSize: 12.5, color: C.muted, textAlign: 'center', textTransform: 'capitalize' },
  metaCard: {
    backgroundColor: '#fff', borderRadius: 14,
    borderWidth: 1, borderColor: C.border,
    marginBottom: 14, overflow: 'hidden',
  },
  metaFila: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  metaLabel: { fontSize: 13, color: C.muted },
  metaValor: { fontSize: 13.5, fontWeight: '500', color: C.ink, maxWidth: '60%', textAlign: 'right' },
  smsCard: {
    backgroundColor: 'rgba(24,21,19,0.03)', borderRadius: 12,
    borderWidth: 1, borderColor: C.border,
    padding: 14, marginBottom: 14,
  },
  smsLabel: { fontSize: 11, fontWeight: '600', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  smsTexto: { fontSize: 13, color: '#6B5F55', lineHeight: 20, fontFamily: 'GeistMono' },
  seccionLabel: { fontSize: 11, fontWeight: '600', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  catChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 11, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1, borderColor: C.border,
    backgroundColor: '#fff',
  },
  catChipTexto: { fontSize: 12.5, color: C.ink },
});
