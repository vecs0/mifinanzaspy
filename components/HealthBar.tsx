/**
 * HealthBar
 * Responsabilidad: Barra de salud financiera con proyeccion
 * Usado por: app/(tabs)/index.tsx
 * Depende de: classifier (ResultadoProyeccion), ThemeContext
 */
import { View, Text, StyleSheet } from 'react-native';
import type { ResultadoProyeccion } from '@/services/classifier';
import { useThemeCtx } from '@/services/ThemeContext';
import { colors, colorsDark } from '@/theme/design-system';

interface Props {
  proyeccion: ResultadoProyeccion;
}

const CONFIG = {
  riesgo: {
    key: 'negative' as const,
    label: 'Riesgo',
    copy: (dias: number) => `Actividad baja. Con ${dias} días restantes, mové tu dinero.`,
  },
  atencion: {
    key: 'warn' as const,
    label: 'Atención',
    copy: (dias: number) => `Ajustá un poco. Quedan ${dias} días — moderá los gastos.`,
  },
  estable: {
    key: 'positive' as const,
    label: 'Estable',
    copy: (dias: number) => `Vas en buen ritmo. Quedan ${dias} días de mes.`,
  },
};

export function HealthBar({ proyeccion }: Props) {
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;
  const s = useStyles(t);

  const cfg = { ...CONFIG[proyeccion.estadoSalud], color: t[CONFIG[proyeccion.estadoSalud].key] };
  const pct = Math.min(100, Math.max(0, proyeccion.pctGastado));

  return (
    <View style={s.card} accessible accessibilityLabel={`Salud del mes: ${cfg.label}, ${pct} por ciento del ingreso gastado`}>
      <View style={s.header}>
        <View style={s.left}>
          <View style={[s.dot, { backgroundColor: cfg.color }]} />
          <Text style={[s.label, { color: cfg.color }]}>
            Salud del mes — {cfg.label}
          </Text>
        </View>
        <Text style={[s.pct, { color: cfg.color }]}>{pct}%</Text>
      </View>

      <View style={[s.track, { backgroundColor: t.hairline }]}>
        <View style={[s.fill, { width: `${pct}%`, backgroundColor: cfg.color }]} />
      </View>

      <Text style={[s.copy, { color: t.ink2 }]}>
        {cfg.copy(proyeccion.diasRestantes)}
      </Text>

      <View style={s.footer}>
        <Text style={[s.footerLabel, { color: t.ink3 }]}>
          Saldo proyectado al fin de mes
        </Text>
        <Text
          style={[
            s.footerAmount,
            {
              color: proyeccion.saldoProyectado >= 0 ? t.positive : t.negative,
            },
          ]}
        >
          Gs {proyeccion.saldoProyectado.toLocaleString('es-PY')}
        </Text>
      </View>
    </View>
  );
}

function useStyles(t: typeof colors) {
  return StyleSheet.create({
    card: {
      paddingVertical: 8,
      gap: 12,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    left: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    dot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    label: {
      fontSize: 13,
      fontWeight: '600',
    },
    pct: {
      fontSize: 16,
      fontWeight: '700',
      fontFamily: 'GeistMono',
    },
    track: {
      height: 6,
      borderRadius: 3,
      overflow: 'hidden',
    },
    fill: {
      height: '100%',
      borderRadius: 3,
    },
    copy: {
      fontSize: 13,
      lineHeight: 19,
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 2,
    },
    footerLabel: {
      fontSize: 12,
    },
    footerAmount: {
      fontSize: 13,
      fontWeight: '700',
      fontFamily: 'GeistMono',
    },
  });
}
