// app/(tabs)/historial.tsx — Historial de transacciones con filtros
import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  ScrollView, StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getTransacciones } from '@/services/database';
import { TransactionRow } from '@/components/TransactionRow';
import { BANCO_POR_ID } from '@/constants/banks';
import { CATEGORIA_POR_ID } from '@/constants/categories';
import type { Transaccion } from '@/types/finance';

const C = {
  bg:     '#FAF8F4',
  ink:    '#181513',
  copper: '#B36A2A',
  muted:  '#9B8E84',
  border: 'rgba(24,21,19,0.08)',
  surface:'rgba(24,21,19,0.04)',
};

const PERIODOS = [
  { id: 'hoy',    label: 'Hoy'    },
  { id: 'semana', label: '7 días' },
  { id: 'mes',    label: 'Mes'    },
  { id: 'todo',   label: 'Todo'   },
];

function getFechaDesde(periodo: string): string | undefined {
  const hoy = new Date();
  if (periodo === 'hoy') {
    return hoy.toISOString().slice(0, 10);
  }
  if (periodo === 'semana') {
    const d = new Date(hoy);
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  }
  if (periodo === 'mes') {
    return `${hoy.toISOString().slice(0, 7)}-01`;
  }
  return undefined;
}

export default function HistorialScreen() {
  const [transacciones, setTransacciones] = useState<Transaccion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] = useState(false);
  const [periodo, setPeriodo] = useState('mes');
  const [filtroCategoria, setFiltroCategoria] = useState<string | null>(null);

  const cargar = useCallback(async (refresh = false) => {
    if (refresh) setActualizando(true); else setCargando(true);
    try {
      const desde = getFechaDesde(periodo);
      const txs = await getTransacciones({
        desde: desde ? `${desde}T00:00:00` : undefined,
        categoriaId: filtroCategoria ?? undefined,
        limite: 200,
      });
      setTransacciones(txs);
    } finally {
      setCargando(false);
      setActualizando(false);
    }
  }, [periodo, filtroCategoria]);

  useEffect(() => { cargar(); }, [cargar]);

  const totalEgresos  = transacciones.filter(t => t.monto < 0).reduce((s, t) => s + Math.abs(t.monto), 0);
  const totalIngresos = transacciones.filter(t => t.monto > 0).reduce((s, t) => s + t.monto, 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.titulo}>Historial</Text>
        <View style={s.totalesRow}>
          <Text style={[s.totalChip, { color: '#3F8E5A' }]}>
            +Gs {totalIngresos.toLocaleString('es-PY')}
          </Text>
          <Text style={[s.totalChip, { color: '#A8401F' }]}>
            −Gs {totalEgresos.toLocaleString('es-PY')}
          </Text>
        </View>
      </View>

      {/* Filtro de período */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.chipsRow}>
        {PERIODOS.map(p => (
          <TouchableOpacity
            key={p.id}
            style={[s.chip, periodo === p.id && s.chipActive]}
            onPress={() => setPeriodo(p.id)}
          >
            <Text style={[s.chipLabel, periodo === p.id && s.chipLabelActive]}>
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Lista */}
      {cargando ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={C.copper} />
        </View>
      ) : (
        <FlatList
          data={transacciones}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingBottom: 24 }}
          refreshControl={
            <RefreshControl
              refreshing={actualizando}
              onRefresh={() => cargar(true)}
              tintColor={C.copper}
            />
          }
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: 48 }}>
              <Text style={{ color: C.muted, fontSize: 15 }}>
                Sin movimientos en este período
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TransactionRow transaccion={item} />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  titulo: {
    fontSize: 22,
    fontWeight: '700',
    color: '#181513',
    letterSpacing: -0.3,
  },
  totalesRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
  totalChip: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'GeistMono',
  },
  chipsRow: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 8,
    flexDirection: 'row',
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(24,21,19,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(24,21,19,0.08)',
  },
  chipActive: {
    backgroundColor: '#B36A2A',
    borderColor: '#B36A2A',
  },
  chipLabel: {
    fontSize: 13,
    color: '#6B5F55',
    fontWeight: '500',
  },
  chipLabelActive: {
    color: '#FAF8F4',
    fontWeight: '600',
  },
});
