/**
 * banco/[id].tsx
 * Responsabilidad: Detalle de una cuenta bancaria con sus transacciones
 * Usado por: index.tsx, historial.tsx (router.push)
 * Depende de: database, banks
 */
import { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Path } from 'react-native-svg';
import { getTransacciones } from '@/services/database';
import { BANCO_POR_ID } from '@/constants/banks';
import { BankLogo } from '@/components/BankLogo';
import { TransactionRow } from '@/components/TransactionRow';
import { Money } from '@/components/Money';
import { EmptyState } from '@/components/EmptyState';
import { InlineError } from '@/components/InlineError';
import { SkeletonRows } from '@/components/Skeleton';
import { useThemeCtx } from '@/services/ThemeContext';
import { colors, colorsDark, iconStroke, hit } from '@/theme/design-system';
import type { Transaccion } from '@/types/finance';

export default function BancoDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;
  const banco = BANCO_POR_ID[id ?? ''] ?? null;
  const [txs, setTxs] = useState<Transaccion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      setTxs(await getTransacciones({ bancoId: id, limite: 500 }));
    } catch (e) {
      console.error('Banco error:', e);
      setError('No pudimos cargar los movimientos de esta cuenta.');
    } finally {
      setCargando(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  const ingresos = txs.reduce((acc, x) => acc + (x.monto > 0 ? x.monto : 0), 0);
  const egresos  = txs.reduce((acc, x) => acc + (x.monto < 0 ? Math.abs(x.monto) : 0), 0);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 4 }}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={hit}
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
          accessibilityRole="button"
          accessibilityLabel="Volver"
        >
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none"
            stroke={t.ink} strokeWidth={iconStroke} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M15 5l-7 7 7 7" />
          </Svg>
        </TouchableOpacity>
        {banco && <BankLogo bancoId={banco.id} size={32} />}
        <View>
          <Text style={{ fontSize: 18, fontWeight: '700', color: t.ink }} accessibilityRole="header">
            {banco?.corto ?? id}
          </Text>
          <Text style={{ fontSize: 13, color: t.ink2 }}>{txs.length} movimientos</Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 32, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 20 }}>
        <View>
          <Text style={{ fontSize: 12, color: t.muteText, fontWeight: '500', marginBottom: 4 }}>Ingresos</Text>
          <Money amount={ingresos} currency="PYG" size="medium" sign="never" style={{ color: t.positive }} />
        </View>
        <View>
          <Text style={{ fontSize: 12, color: t.muteText, fontWeight: '500', marginBottom: 4 }}>Egresos</Text>
          <Money amount={egresos} currency="PYG" size="medium" sign="never" style={{ color: t.negative }} />
        </View>
      </View>

      {error && (
        <View style={{ paddingHorizontal: 24, paddingBottom: 12 }}>
          <InlineError mensaje={error} onReintentar={cargar} />
        </View>
      )}

      {cargando ? (
        <View style={{ paddingHorizontal: 24 }}><SkeletonRows count={5} /></View>
      ) : (
        <FlatList
          data={txs}
          keyExtractor={x => x.id}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
          renderItem={({ item }) => <TransactionRow transaccion={item} onPress={() => router.push(`/transaccion/${item.id}` as any)} />}
          ListEmptyComponent={
            <EmptyState
              titulo="Sin movimientos en esta cuenta"
              texto="Cuando registres o captures un gasto de este banco, va a aparecer acá."
            />
          }
        />
      )}
    </SafeAreaView>
  );
}
