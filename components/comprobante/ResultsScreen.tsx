/**
 * ResultsScreen
 * Responsabilidad: Vista previa y validacion de movimientos antes de guardar
 * Usado por: app/comprobante.tsx
 * Depende de: comprobanteTypes, transaccionValidator, ValidationBanner
 */
import { useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useThemeCtx } from '@/services/ThemeContext';
import { colors, colorsDark } from '@/theme/design-system';
import { Money } from '@/components/Money';
import type { MovimientoDetectado } from '@/services/comprobanteTypes';
import { validarItems } from '@/services/transaccionValidator';
import ValidationBanner from '@/components/comprobante/ValidationBanner';

function CheckIcon({ color }: { color: string }) {
  return <Svg width={16} height={16} viewBox="0 0 16 16"><Path d="M4 8l3 3 5-5" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}
function EditIcon({ color }: { color: string }) {
  return <Svg width={16} height={16} viewBox="0 0 16 16"><Path d="M11.5 2.5a1.414 1.414 0 012 2L5 13l-3 1 1-3 8.5-8.5z" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}



function groupByMonth(movs: MovimientoDetectado[]) {
  const map = new Map<string, MovimientoDetectado[]>();
  movs.forEach(m => {
    const key = m.mes || 'Sin fecha';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(m);
  });
  return Array.from(map.entries()).map(([mes, items]) => ({ mes, items }));
}

interface Props {
  movimientos: MovimientoDetectado[];
  totalEsperado?: number;
  mergedCount?: number;
  onEdit: () => void;
  onProcess: () => void;
}

export default function ResultsScreen({ movimientos, totalEsperado, mergedCount, onEdit, onProcess }: Props) {
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;

  const groups = useMemo(() => groupByMonth(movimientos), [movimientos]);
  const reporte = useMemo(() => validarItems(movimientos, { totalEsperado }), [movimientos, totalEsperado]);
  const totalIngresos = movimientos.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0);
  const totalEgresos  = movimientos.filter(m => m.tipo === 'egreso').reduce((s, m) => s + m.monto, 0);
  const isReport = movimientos.length > 1;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: isReport ? (dark ? '#0d1e30' : '#E6F1FB') : (dark ? '#0d2218' : '#EAF5EE'), marginBottom: 12 }}>
          <Text style={{ fontSize: 12, fontWeight: '600', color: isReport ? (dark ? '#6aacdc' : '#185FA5') : (dark ? '#4db88a' : '#1B7A45') }}>
            {isReport ? `Reporte · ${movimientos.length} movimientos${mergedCount ? ` (${mergedCount} fusionados)` : ''}` : 'Comprobante individual'}
          </Text>
        </View>

        {!reporte.ok && <ValidationBanner reporte={reporte} />}

        <Text style={{ fontSize: 20, fontWeight: '700', color: t.ink, marginBottom: 16 }}>
          Resultado del análisis
        </Text>

        {isReport && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            <View style={{ flex: 1, minWidth: '45%', backgroundColor: t.card, borderRadius: 10, padding: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: t.hairline }}>
              <Text style={{ fontSize: 11, color: t.ink2, marginBottom: 4 }}>Total ingresos</Text>
              <Money amount={totalIngresos} size="small" sign="never" />
            </View>
            <View style={{ flex: 1, minWidth: '45%', backgroundColor: t.card, borderRadius: 10, padding: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: t.hairline }}>
              <Text style={{ fontSize: 11, color: t.ink2, marginBottom: 4 }}>Total egresos</Text>
              <Money amount={totalEgresos} size="small" sign="never" />
            </View>
          </View>
        )}

        <Text style={{ fontSize: 11, fontWeight: '600', color: t.ink3, letterSpacing: 0.6, marginBottom: 10, textTransform: 'uppercase' }}>
          {isReport ? 'Movimientos detectados' : 'Movimiento detectado'}
        </Text>

        {groups.map(({ mes, items }) => (
          <View key={mes} style={{ marginBottom: 16 }}>
            {isReport && (
              <Text style={{ fontSize: 11, fontWeight: '600', color: t.ink3, textTransform: 'uppercase', letterSpacing: 0.6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.hairline, paddingBottom: 6, marginBottom: 8 }}>
                {mes}
              </Text>
            )}
            {items.map(mov => {
              const color = mov.tipo === 'egreso' ? t.negative : t.positive;
              const iconBg = mov.tipo === 'egreso'
                ? (dark ? '#2a0e0e' : '#FCEBEB')
                : (dark ? '#0d2218' : '#EAF5EE');
              return (
                <View key={mov._tempId} style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.hairline }}>
                  <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: iconBg, alignItems: 'center', justifyContent: 'center', marginRight: 10, marginTop: 2 }}>
                    <Svg width={16} height={16} viewBox="0 0 16 16">
                      <Path d={mov.tipo === 'egreso' ? 'M8 3v10M4 9l4 4 4-4' : 'M8 13V3M4 7l4-4 4 4'} fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                  </View>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={{ fontSize: 14, fontWeight: '500', color: t.ink }} numberOfLines={1}>{mov.descripcion || 'Sin descripción'}</Text>
                    {mov.banco ? <Text style={{ fontSize: 12, color: t.ink3, fontStyle: 'italic', marginTop: 1 }}>{mov.banco}</Text> : null}
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Money amount={mov.monto} size="small" sign="always" />
                    <Text style={{ fontSize: 11, color: t.ink3, marginTop: 2 }}>{mov.hora || '00:00'}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        ))}
      </ScrollView>

      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', gap: 10, padding: 16, paddingBottom: 24, backgroundColor: t.bg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.hairline }}>
        <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: t.hairline, backgroundColor: t.card }} onPress={onEdit}>
          <EditIcon color={t.ink} />
          <Text style={{ fontSize: 14, fontWeight: '500', color: t.ink }}>Editar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ flex: 1.6, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 13, borderRadius: 12, backgroundColor: t.accent }} onPress={onProcess}>
          <CheckIcon color="#fff" />
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#FAF8F4' }}>Procesar y guardar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
