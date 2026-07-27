/**
 * TransactionRow
 * Responsabilidad: Fila de transaccion con monto, categoria y banco
 * Usado por: historial, index, banco/[id]
 * Depende de: categories, banks, CategoriaChip, Money
 */
import { View, Text, TouchableOpacity } from 'react-native';
import { CATEGORIA_POR_ID } from '@/constants/categories';
import { BANCO_POR_ID } from '@/constants/banks';
import { CategoriaChip } from '@/components/CategoriaChip';
import { Money } from '@/components/Money';
import { useThemeCtx } from '@/services/ThemeContext';
import { colors, colorsDark } from '@/theme/design-system';
import type { Transaccion, Moneda } from '@/types/finance';

interface Props {
  transaccion: Transaccion;
  moneda?: Moneda;
  onPress?: () => void;
}

const FUENTE_LABEL: Record<string, string> = {
  sms:         'SMS',
  notificacion:'Notif.',
  manual:      'Manual',
  csv:         'CSV',
  email:       'Email',
};

export function TransactionRow({ transaccion: tx, moneda = 'PYG', onPress }: Props) {
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;
  const cat   = CATEGORIA_POR_ID[tx.categoriaId];
  const banco = BANCO_POR_ID[tx.bancoId];
  const esIngreso = tx.monto > 0;
  const esEfectivo = tx.bancoId === 'efectivo' || tx.cuentaId === '__efectivo__';

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
    <TouchableOpacity
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 10,
      }}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <CategoriaChip categoriaId={tx.categoriaId} size="md" />

      <View style={{ flex: 1, gap: 3 }}>
        <Text style={{ fontSize: 13.5, fontWeight: '500', color: t.ink }} numberOfLines={1}>
          {tx.descripcion || cat?.nombre || 'Transacción'}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          {esEfectivo ? (
            <View style={{
              paddingHorizontal: 5, paddingVertical: 1,
              backgroundColor: dark ? '#0d2218' : '#d8f0e6',
              borderRadius: 4,
            }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: dark ? '#4db88a' : '#2d7a56' }}>Efectivo</Text>
            </View>
          ) : banco ? (
            <Text style={{ fontSize: 11.5, color: t.muteText }}>{banco.corto}</Text>
          ) : null}
          {(esEfectivo || banco) && <Text style={{ fontSize: 11, color: t.ink3 }}>·</Text>}
          <Text style={{ fontSize: 11.5, color: t.muteText }}>{formatFecha(tx.fecha)}</Text>
          <Text style={{ fontSize: 11, color: t.ink3 }}>·</Text>
          <Text style={{ fontSize: 11, fontWeight: '500', color: cat?.tinte ?? t.muteText }}>
            {FUENTE_LABEL[tx.fuente] ?? tx.fuente}
          </Text>
        </View>
      </View>

      <Money amount={tx.monto} currency={moneda} size="small" sign="always" />
    </TouchableOpacity>
  );
}
