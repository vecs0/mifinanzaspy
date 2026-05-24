// components/BankCard.tsx — Tarjeta de saldo por banco (scroll horizontal)
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { BANCO_POR_ID } from '@/constants/banks';
import type { CuentaBancaria } from '@/types/finance';

interface Props {
  cuenta: CuentaBancaria;
  onPress?: () => void;
}

export function BankCard({ cuenta, onPress }: Props) {
  const banco = BANCO_POR_ID[cuenta.bancoId];
  const tinte = banco?.tinte ?? cuenta.color;

  function formatMonto(n: number, moneda: string): string {
    if (moneda === 'USD') {
      return `USD ${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
    }
    return `Gs ${n.toLocaleString('es-PY')}`;
  }

  return (
    <TouchableOpacity style={[s.card, { borderTopColor: tinte }]} onPress={onPress} activeOpacity={0.8}>
      {/* Monograma */}
      <View style={[s.monograma, { backgroundColor: tinte }]}>
        <Text style={s.monogramaTexto}>{banco?.monograma ?? cuenta.alias[0].toUpperCase()}</Text>
      </View>

      {/* Info */}
      <Text style={s.alias} numberOfLines={1}>{cuenta.alias}</Text>
      <Text style={s.bancoNombre} numberOfLines={1}>{banco?.corto ?? cuenta.bancoNombre}</Text>

      {/* Saldo */}
      <Text style={[s.saldo, { color: cuenta.saldoActual < 0 ? '#A8401F' : '#181513' }]}>
        {formatMonto(cuenta.saldoActual, cuenta.moneda)}
      </Text>

      {/* Tipo */}
      <View style={[s.tipoBadge, { backgroundColor: `${tinte}18` }]}>
        <Text style={[s.tipoTexto, { color: tinte }]}>{cuenta.tipoCuenta}</Text>
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card: {
    width: 148,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(24,21,19,0.08)',
    borderTopWidth: 3,
    gap: 4,
  },
  monograma: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  monogramaTexto: { color: '#fff', fontSize: 14, fontWeight: '700' },
  alias:      { fontSize: 13.5, fontWeight: '600', color: '#181513' },
  bancoNombre:{ fontSize: 11.5, color: '#9B8E84' },
  saldo: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'GeistMono',
    marginTop: 6,
    letterSpacing: -0.3,
  },
  tipoBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 4,
  },
  tipoTexto: { fontSize: 10, fontWeight: '600', textTransform: 'capitalize' },
});
