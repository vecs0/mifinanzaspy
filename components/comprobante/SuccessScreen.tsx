/**
 * SuccessScreen
 * Responsabilidad: Pantalla de exito con resumen de movimientos guardados
 * Usado por: app/comprobante.tsx
 * Depende de: comprobanteTypes, ThemeContext
 */
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useThemeCtx } from '@/services/ThemeContext';
import { colors, colorsDark } from '@/theme/design-system';
import { Money } from '@/components/Money';
import type { MovimientoDetectado } from '@/services/comprobanteTypes';

function CheckCircleIcon({ color }: { color: string }) {
  return (
    <Svg width={34} height={34} viewBox="0 0 34 34">
      <Path d="M17 31c7.732 0 14-6.268 14-14S24.732 3 17 3 3 9.268 3 17s6.268 14 14 14z" fill="none" stroke={color} strokeWidth={2} />
      <Path d="M11 17l4 4 8-8" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

interface Props {
  movimientos: MovimientoDetectado[];
  savedCount: number;
  onDone: () => void;
}

export default function SuccessScreen({ movimientos, savedCount, onDone }: Props) {
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;

  const totalIngresos = movimientos.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0);
  const totalEgresos  = movimientos.filter(m => m.tipo === 'egreso').reduce((s, m) => s + m.monto, 0);
  const isReport = movimientos.length > 1;

  const iconBg = t.positiveBg;

  return (
    <View style={{ flex: 1, alignItems: 'center', paddingHorizontal: 24, paddingTop: 56 }}>
      <View style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: iconBg, alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
        <CheckCircleIcon color={t.positive} />
      </View>

      <Text style={{ fontSize: 22, fontWeight: '600', color: t.ink, marginBottom: 10, textAlign: 'center' }}>
        ¡Movimientos registrados!
      </Text>
      <Text style={{ fontSize: 14, color: t.ink2, textAlign: 'center', lineHeight: 20, marginBottom: 28 }}>
        {isReport
          ? 'Todos los movimientos del reporte fueron organizados por fecha en tu historial.'
          : 'El comprobante fue procesado y agregado a tu registro de movimientos.'}
      </Text>

      <View style={{ width: '100%', backgroundColor: t.card, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: t.hairline, paddingHorizontal: 16, marginBottom: 32 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.hairline }}>
          <Text style={{ fontSize: 13, color: t.ink2 }}>Movimientos procesados</Text>
          <Text style={{ fontSize: 13, fontWeight: '600', color: t.ink }}>{savedCount} registros</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.hairline }}>
          <Text style={{ fontSize: 13, color: t.ink2 }}>Fecha de registro</Text>
          <Text style={{ fontSize: 13, fontWeight: '600', color: t.ink }}>{new Date().toLocaleDateString('es-PY')}</Text>
        </View>
        {totalIngresos > 0 && (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.hairline }}>
            <Text style={{ fontSize: 13, color: t.ink2 }}>Total ingresos</Text>
            <Money amount={totalIngresos} size="small" sign="never" />
          </View>
        )}
        {totalEgresos > 0 && (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 0, borderBottomColor: t.hairline }}>
            <Text style={{ fontSize: 13, color: t.ink2 }}>Total egresos</Text>
            <Money amount={totalEgresos} size="small" sign="never" />
          </View>
        )}
      </View>

      <TouchableOpacity style={{ width: '100%', paddingVertical: 14, borderRadius: 12, backgroundColor: t.accent, alignItems: 'center' }} onPress={onDone}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: t.onAccent }}>Listo</Text>
      </TouchableOpacity>
    </View>
  );
}
