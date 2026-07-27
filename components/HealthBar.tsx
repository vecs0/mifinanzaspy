/**
 * HealthBar
 * Responsabilidad: Barra de salud financiera con proyeccion
 * Usado por: app/(tabs)/index.tsx
 * Depende de: classifier (ResultadoProyeccion), ThemeContext
 */
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { ResultadoProyeccion } from '@/services/classifier';
import { useThemeCtx } from '@/services/ThemeContext';
import { colors, colorsDark } from '@/theme/design-system';

interface Props {
  proyeccion: ResultadoProyeccion;
}

const CONFIG = {
  riesgo: {
    color: '#A8401F',
    bg: 'rgba(168,64,31,0.12)',
    label: 'Riesgo',
    copy: (dias: number) => `Actividad baja. Con ${dias} días restantes, mové tu dinero.`,
  },
  atencion: {
    color: '#C98330',
    bg: 'rgba(201,131,48,0.12)',
    label: 'Atención',
    copy: (dias: number) => `Ajustá un poco. Quedan ${dias} días — moderá los gastos.`,
  },
  estable: {
    color: '#3F8E5A',
    bg: 'rgba(63,142,90,0.12)',
    label: 'Estable',
    copy: (dias: number) => `Vas en buen ritmo. Quedan ${dias} días de mes.`,
  },
};

export function HealthBar({ proyeccion }: Props) {
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;
  const s = useStyles(t);

  const cfg = CONFIG[proyeccion.estadoSalud];
  const pct = Math.min(100, Math.max(0, proyeccion.pctGastado));

  return (
    <View style={[s.card, { backgroundColor: t.card, borderColor: t.hairline }]}>
      <View style={s.header}>
        <View style={s.left}>
          <View style={[s.dot, { backgroundColor: cfg.color }]}>
            <Svg width={11} height={11} viewBox="0 0 11 11" fill="#fff">
              <Path d="M5.5 0a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11z" />
            </Svg>
          </View>
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
              color: proyeccion.saldoProyectado >= 0
                ? (dark ? '#9FE0B5' : '#3F8E5A')
                : (dark ? '#E57A5E' : '#A8401F'),
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
      padding: 16,
      borderRadius: 14,
      gap: 10,
      borderWidth: 1,
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
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
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
      fontSize: 12.5,
      lineHeight: 18,
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
