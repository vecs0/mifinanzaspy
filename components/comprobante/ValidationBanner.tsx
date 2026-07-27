/**
 * ValidationBanner
 * Responsabilidad: Banner plegable con advertencias/errores de validacion
 * Usado por: ResultsScreen, transaccionValidator
 * Depende de: transaccionValidator, ThemeContext
 */
import { useState } from 'react';
import { View, Text, TouchableOpacity, LayoutAnimation, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { useThemeCtx } from '@/services/ThemeContext';
import { colors, colorsDark } from '@/theme/design-system';
import type { ReporteValidacion, Warning } from '@/services/transaccionValidator';

const NIVEL = {
  info:    { bg: '#EAF5EE', bgDark: '#0d2218', border: '#3F8E5A', color: '#3F8E5A' },
  warning: { bg: '#FDF0E0', bgDark: '#2a1a08', border: '#C98330', color: '#C98330' },
  error:   { bg: '#FCEBEB', bgDark: '#2a0e0e', border: '#A8401F', color: '#A8401F' },
};

function InfoIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18">
      <Circle cx="9" cy="9" r="8" fill="none" stroke={color} strokeWidth={1.5} />
      <Path d="M9 8v5M9 5.5v1" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

function WarningIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18">
      <Path d="M9 2L1 16h16L9 2zM9 11v1M9 7v2" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ErrorIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18">
      <Circle cx="9" cy="9" r="8" fill="none" stroke={color} strokeWidth={1.5} />
      <Path d="M6 6l6 6M12 6l-6 6" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

function ChevronIcon({ expandido, color }: { expandido: boolean; color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 14 14">
      <Path d={expandido ? 'M4 9l3-3 3 3' : 'M4 5l3 3 3-3'} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function nivelMayor(warnings: Warning[]): Warning['nivel'] {
  if (warnings.some(w => w.nivel === 'error'))   return 'error';
  if (warnings.some(w => w.nivel === 'warning')) return 'warning';
  return 'info';
}

interface Props {
  reporte: ReporteValidacion;
}

export default function ValidationBanner({ reporte }: Props) {
  const [expandido, setExpandido] = useState(false);
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;
  const s = useStyles(t);

  if (reporte.ok && reporte.warnings.length === 0) return null;

  const nivel = nivelMayor(reporte.warnings);
  const cfg = NIVEL[nivel];
  const est = reporte.estadisticas;
  const bannerBg = dark ? cfg.bgDark : cfg.bg;

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandido(e => !e);
  };

  const Icon = nivel === 'error' ? ErrorIcon : nivel === 'warning' ? WarningIcon : InfoIcon;

  return (
    <View style={[s.banner, { backgroundColor: bannerBg, borderColor: cfg.border }]}>
      <TouchableOpacity style={s.headerRow} onPress={toggle} activeOpacity={0.7}>
        <Icon color={cfg.color} />
        <View style={{ flex: 1 }}>
          <Text style={[s.titulo, { color: cfg.color }]}>
            {nivel === 'error' ? 'Error en los datos'
              : nivel === 'warning' ? 'Revisá los movimientos'
              : 'Información del análisis'}
          </Text>
          <Text style={[s.resumen, { color: cfg.color }]}>
            Gemini detectó {est.totalItems} movimiento{est.totalItems !== 1 ? 's' : ''}
            {reporte.mergedCount > 0 ? ` · ${reporte.mergedCount} fusionados` : ''}
            {est.duplicadosDetectados > 0 ? ` · ${est.duplicadosDetectados} posibles duplicados` : ''}
            {est.itemsMontoRaro > 0 ? ` · ${est.itemsMontoRaro} montos sospechosos` : ''}
          </Text>
        </View>
        <ChevronIcon expandido={expandido} color={cfg.color} />
      </TouchableOpacity>

      {expandido && (
        <View style={[s.detalle, { borderTopColor: t.hairline }]}>
          <View style={[s.statsRow, { backgroundColor: dark ? 'rgba(241,237,230,0.06)' : t.surface }]}>
            <StatChip label="Ingresos" value={`Gs. ${Math.round(est.sumaIngresos).toLocaleString('es-PY')}`} color={t.positive} labelColor={t.ink3} />
            <StatChip label="Egresos" value={`Gs. ${Math.round(Math.abs(est.sumaEgresos)).toLocaleString('es-PY')}`} color={t.negative} labelColor={t.ink3} />
            <StatChip label="Balance" value={`Gs. ${Math.round(est.balanceNeto).toLocaleString('es-PY')}`} color={est.balanceNeto >= 0 ? t.positive : t.negative} labelColor={t.ink3} />
          </View>

          {est.rangoFechas && (
            <Text style={[s.rangoText, { color: t.ink2 }]}>
              {est.rangoFechas.desde} → {est.rangoFechas.hasta}
            </Text>
          )}

          {reporte.warnings.map((w, i) => {
            const wCfg = NIVEL[w.nivel];
            return (
              <View key={i} style={[s.warningRow, { borderLeftColor: wCfg.color }]}>
                <Text style={[s.warningMsg, { color: wCfg.color }]}>{w.mensaje}</Text>
                {w.detalle && <Text style={[s.warningDetalle, { color: t.ink2 }]}>{w.detalle}</Text>}
              </View>
            );
          })}

          <Text style={[s.consejo, { color: cfg.color }]}>
            {nivel === 'warning'
              ? 'Tocá "Editar" para corregir los datos antes de guardar.'
              : 'Los datos fueron procesados. Revisá si todo está correcto.'}
          </Text>
        </View>
      )}
    </View>
  );
}

function StatChip({ label, value, color, labelColor }: { label: string; value: string; color: string; labelColor: string }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={{ fontSize: 10, color: labelColor, marginBottom: 2 }}>{label}</Text>
      <Text style={{ fontSize: 12, fontWeight: '600', color }}>{value}</Text>
    </View>
  );
}

function useStyles(t: typeof colors) {
  return StyleSheet.create({
    banner: { borderRadius: 12, borderWidth: 1, marginBottom: 16, overflow: 'hidden' },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
    titulo: { fontSize: 13, fontWeight: '600' },
    resumen: { fontSize: 12, marginTop: 1, opacity: 0.85 },
    detalle: { borderTopWidth: StyleSheet.hairlineWidth, padding: 12, gap: 10 },
    statsRow: { borderRadius: 8, padding: 10, gap: 8, flexDirection: 'row' },
    rangoText: { fontSize: 12 },
    warningRow: { borderLeftWidth: 3, paddingLeft: 10, paddingVertical: 4 },
    warningMsg: { fontSize: 13, fontWeight: '500' },
    warningDetalle: { fontSize: 12, marginTop: 2, lineHeight: 16 },
    consejo: { fontSize: 12, fontStyle: 'italic', marginTop: 4 },
  });
}
