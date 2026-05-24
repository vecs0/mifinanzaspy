// components/HealthIndicator.tsx — Indicador de salud financiera del mes
import { View, Text, StyleSheet } from 'react-native';
import type { ResultadoProyeccion } from '@/services/classifier';

interface Props {
  proyeccion: ResultadoProyeccion;
}

const CONFIG = {
  estable:  {
    color: '#3F8E5A',
    bg:    'rgba(63,142,90,0.10)',
    label: 'Estable',
    emoji: '✓',
    copy:  (dias: number) => `Vas en buen ritmo. Quedan ${dias} días de mes.`,
  },
  atencion: {
    color: '#C98330',
    bg:    'rgba(201,131,48,0.10)',
    label: 'Atención',
    emoji: '!',
    copy:  (dias: number) => `Ajustá un poco. Quedan ${dias} días — moderá los gastos.`,
  },
  riesgo:   {
    color: '#A8401F',
    bg:    'rgba(168,64,31,0.10)',
    label: 'Riesgo',
    emoji: '↓',
    copy:  (dias: number) => `Frená el ritmo. Con ${dias} días restantes la proyección es negativa.`,
  },
};

export function HealthIndicator({ proyeccion }: Props) {
  const cfg = CONFIG[proyeccion.estadoSalud];
  const pct = Math.min(100, Math.max(0, proyeccion.pctGastado));

  return (
    <View style={[s.contenedor, { backgroundColor: cfg.bg, borderColor: `${cfg.color}30` }]}>
      {/* Encabezado */}
      <View style={s.cabecera}>
        <View style={s.izquierda}>
          <View style={[s.dot, { backgroundColor: cfg.color }]}>
            <Text style={s.dotTexto}>{cfg.emoji}</Text>
          </View>
          <Text style={[s.label, { color: cfg.color }]}>
            Salud del mes · {cfg.label}
          </Text>
        </View>
        <Text style={[s.pct, { color: cfg.color }]}>{pct}%</Text>
      </View>

      {/* Barra de progreso */}
      <View style={s.barraTrack}>
        <View style={[s.barraProg, { width: `${pct}%`, backgroundColor: cfg.color }]} />
      </View>

      {/* Descripción */}
      <Text style={s.desc}>{cfg.copy(proyeccion.diasRestantes)}</Text>

      {/* Proyección numérica */}
      <View style={s.proyRow}>
        <Text style={s.proyLabel}>Saldo proyectado al fin de mes:</Text>
        <Text style={[s.proyMonto, { color: proyeccion.saldoProyectado >= 0 ? '#3F8E5A' : '#A8401F' }]}>
          Gs {proyeccion.saldoProyectado.toLocaleString('es-PY')}
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  contenedor: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  cabecera:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  izquierda: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: {
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  dotTexto: { color: '#fff', fontSize: 11, fontWeight: '700' },
  label:    { fontSize: 13, fontWeight: '600' },
  pct:      { fontSize: 16, fontWeight: '700', fontFamily: 'GeistMono' },
  barraTrack: {
    height: 6, borderRadius: 3,
    backgroundColor: 'rgba(24,21,19,0.08)',
    overflow: 'hidden',
  },
  barraProg: { height: '100%', borderRadius: 3 },
  desc: { fontSize: 12.5, color: '#6B5F55', lineHeight: 18 },
  proyRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
  proyLabel: { fontSize: 12, color: '#9B8E84' },
  proyMonto: { fontSize: 13, fontWeight: '700', fontFamily: 'GeistMono' },
});
