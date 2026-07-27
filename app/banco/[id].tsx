/**
 * banco/[id].tsx
 * Responsabilidad: Detalle de una cuenta bancaria con sus transacciones
 * Usado por: index.tsx, historial.tsx (router.push)
 * Depende de: database, banks
 */
import { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { getTransacciones } from '@/services/database';
import { BANCO_POR_ID } from '@/constants/banks';
import { BankLogo } from '@/components/BankLogo';
import { TransactionRow } from '@/components/TransactionRow';
import { Money } from '@/components/Money';
import { useThemeCtx } from '@/services/ThemeContext';
import { colors, colorsDark } from '@/theme/design-system';
import type { Transaccion } from '@/types/finance';

const C_INGRESO = '#3F8E5A';
const C_EGRESO  = '#A8401F';

export default function BancoDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;
  const banco = BANCO_POR_ID[id ?? ''] ?? null;
  const [txs, setTxs] = useState<Transaccion[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const todas = await getTransacciones({ limite: 500 });
      const filtradas = todas.filter((t: Transaccion) => t.bancoId === id);
      setTxs(filtradas);
      setCargando(false);
    })();
  }, [id]);

  const ingresos = txs.reduce((s, t) => s + (t.monto > 0 ? t.monto : 0), 0);
  const egresos  = txs.reduce((s, t) => s + (t.monto < 0 ? Math.abs(t.monto) : 0), 0);

  if (cargando) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={t.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14 }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none"
            stroke={t.ink} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M15 5l-7 7 7 7" />
          </Svg>
        </TouchableOpacity>
        {banco && <BankLogo bancoId={banco.id} size={32} />}
        <View>
          <Text style={{ fontSize: 18, fontWeight: '700', color: t.ink }}>
            {banco?.corto ?? id}
          </Text>
          <Text style={{ fontSize: 12, color: t.ink3 }}>{txs.length} movimientos</Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingBottom: 16 }}>
        <View style={{ flex: 1, backgroundColor: t.card, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: t.hairline }}>
          <Text style={{ fontSize: 11, color: t.ink3, fontWeight: '500', marginBottom: 4 }}>Ingresos</Text>
          <Money amount={ingresos} currency="PYG" size="small" sign="never" style={{ color: C_INGRESO }} />
        </View>
        <View style={{ flex: 1, backgroundColor: t.card, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: t.hairline }}>
          <Text style={{ fontSize: 11, color: t.ink3, fontWeight: '500', marginBottom: 4 }}>Egresos</Text>
          <Money amount={egresos} currency="PYG" size="small" sign="never" style={{ color: C_EGRESO }} />
        </View>
      </View>

      <FlatList
        data={txs}
        keyExtractor={t => t.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 2 }}
        renderItem={({ item }) => <TransactionRow transaccion={item} onPress={() => router.push(`/transaccion/${item.id}` as any)} />}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <Text style={{ fontSize: 14, color: t.ink3 }}>Sin movimientos</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
