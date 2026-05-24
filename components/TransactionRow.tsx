// components/TransactionRow.tsx — Ítem de transacción en listas
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { CATEGORIA_POR_ID } from '@/constants/categories';
import { BANCO_POR_ID } from '@/constants/banks';
import type { Transaccion } from '@/types/finance';

interface Props {
  transaccion: Transaccion;
  onPress?: () => void;
}

const FUENTE_LABEL: Record<string, string> = {
  sms:         'SMS',
  notificacion:'Notif.',
  manual:      'Manual',
  csv:         'CSV',
  email:       'Email',
};

export function TransactionRow({ transaccion: tx, onPress }: Props) {
  const cat   = CATEGORIA_POR_ID[tx.categoriaId];
  const banco = BANCO_POR_ID[tx.bancoId];
  const esIngreso = tx.monto > 0;

  function formatMonto(n: number): string {
    const abs = Math.abs(n);
    return `Gs ${abs.toLocaleString('es-PY')}`;
  }

  function formatFecha(iso: string): string {
    const d = new Date(iso);
    const hoy = new Date();
    const ayer = new Date(hoy); ayer.setDate(ayer.getDate() - 1);

    if (d.toDateString() === hoy.toDateString()) {
      return `Hoy ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    }
    if (d.toDateString() === ayer.toDateString()) {
      return `Ayer ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    }
    return d.toLocaleDateString('es-PY', { day: '2-digit', month: 'short' });
  }

  return (
    <TouchableOpacity style={s.row} onPress={onPress} activeOpacity={0.7}>
      {/* Ícono de categoría */}
      <View style={[s.iconBg, { backgroundColor: `${cat?.tinte ?? '#6B7280'}18` }]}>
        <Text style={{ fontSize: 16 }}>
          {getCatEmoji(tx.categoriaId)}
        </Text>
      </View>

      {/* Info central */}
      <View style={s.info}>
        <Text style={s.descripcion} numberOfLines={1}>{tx.descripcion || cat?.nombre || 'Transacción'}</Text>
        <View style={s.metaRow}>
          {banco && (
            <Text style={s.metaTexto}>{banco.corto}</Text>
          )}
          <Text style={s.metaSep}>·</Text>
          <Text style={s.metaTexto}>{formatFecha(tx.fecha)}</Text>
          <Text style={s.metaSep}>·</Text>
          <Text style={[s.fuenteBadge, { color: cat?.tinte ?? '#9B8E84' }]}>
            {FUENTE_LABEL[tx.fuente] ?? tx.fuente}
          </Text>
        </View>
      </View>

      {/* Monto */}
      <Text style={[s.monto, { color: esIngreso ? '#3F8E5A' : '#A8401F' }]}>
        {esIngreso ? '+' : '−'}{formatMonto(tx.monto)}
      </Text>
    </TouchableOpacity>
  );
}

// Mapeo simple de categoría → emoji
function getCatEmoji(catId: string): string {
  const map: Record<string, string> = {
    salario:       '💼',
    honorarios:    '📋',
    venta:         '🏷️',
    intereses:     '📈',
    transferencia: '↔️',
    inversion:     '📊',
    supermercado:  '🛒',
    restaurante:   '🍽️',
    combustible:   '⛽',
    transporte:    '🚗',
    servicios:     '⚡',
    telefono:      '📱',
    farmacia:      '💊',
    ropa:          '👕',
    hogar:         '🏠',
    ocio:          '🎵',
    retiro:        '💵',
    deuda:         '💳',
    educacion:     '📚',
    salud:         '❤️',
    otros:         '•',
  };
  return map[catId] ?? '•';
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  iconBg: {
    width: 38, height: 38, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  info:        { flex: 1, gap: 3 },
  descripcion: { fontSize: 13.5, fontWeight: '500', color: '#181513' },
  metaRow:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaTexto:   { fontSize: 11.5, color: '#9B8E84' },
  metaSep:     { fontSize: 11, color: '#C5BDB5' },
  fuenteBadge: { fontSize: 11, fontWeight: '500' },
  monto: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'GeistMono',
    letterSpacing: -0.3,
    flexShrink: 0,
  },
});
