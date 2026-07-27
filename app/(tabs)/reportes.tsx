/**
 * (tabs)/reportes.tsx
 * Responsabilidad: Reportes financieros con gráficos y exportación
 * Usado por: expo-router (tab)
 * Depende de: database, reportGenerator
 */
import { useState, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Modal,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { getTransacciones, setConfig, getConfig } from '@/services/database';
import { Icon } from '@/components/Icon';
import { CATEGORIA_POR_ID } from '@/constants/categories';
import { useThemeCtx } from '@/services/ThemeContext';
import { colors, colorsDark } from '@/theme/design-system';
import { generarReporteMensual } from '@/services/reportGenerator';

const PERIODOS = [
  { id: 'diario',  label: 'Diario'  },
  { id: 'semanal', label: 'Semanal' },
  { id: 'mensual', label: 'Mensual' },
];

function fmtGs(n: number): string {
  return `Gs ${Math.round(Math.abs(n)).toLocaleString('es-PY').replace(/,/g, '.')}`;
}

function fmtGsPlano(n: number): string {
  return `Gs ${Math.round(Math.abs(n)).toLocaleString('es-PY').replace(/,/g, '.')}`;
}

interface MesData {
  ingresos: number;
  egresos:  number;
  topCats:  { categoriaId: string; total: number; pct: number }[];
}

async function getDataRango(desde: string, hasta: string): Promise<MesData> {
  const txs = await getTransacciones({ desde: `${desde}T00:00:00`, hasta: `${hasta}T23:59:59`, limite: 2000 });
  const ingresos = txs.filter(t => t.monto > 0).reduce((s, t) => s + t.monto, 0);
  const egresos  = txs.filter(t => t.monto < 0).reduce((s, t) => s + Math.abs(t.monto), 0);
  const agrupado: Record<string, number> = {};
  for (const t of txs) {
    if (t.monto < 0) agrupado[t.categoriaId] = (agrupado[t.categoriaId] ?? 0) + Math.abs(t.monto);
  }
  const topCats = Object.entries(agrupado)
    .map(([categoriaId, total]) => ({ categoriaId, total, pct: egresos > 0 ? (total / egresos) * 100 : 0 }))
    .sort((a, b) => b.total - a.total);
  return { ingresos, egresos, topCats };
}

async function getDataMes(mes: string): Promise<MesData> {
  const [anio, m] = mes.split('-').map(Number);
  const ultimo = new Date(anio, m, 0).getDate();
  return getDataRango(`${mes}-01`, `${mes}-${String(ultimo).padStart(2, '0')}`);
}

export default function ReportesScreen() {
  const { dark } = useThemeCtx();
  const t = dark ? colorsDark : colors;
  const s = useStyles(t);

  const [periodo, setPeriodo]       = useState('mensual');
  const [cargando, setCargando]     = useState(true);
  const [dataActual, setDataActual] = useState<MesData | null>(null);
  const [dataAnterior, setDataAnterior] = useState<MesData | null>(null);
  const [planModal, setPlanModal]   = useState(false);
  const [planActivo, setPlanActivo] = useState(false);
  const [plan, setPlan]             = useState<{ categoria: string; limite: number; actual: number } | null>(null);
  const [pdfs, setPdfs]             = useState<{ path: string; name: string; size: number }[]>([]);
  const [generando, setGenerando]   = useState(false);
  const [pdfMsg, setPdfMsg]         = useState<{ tipo: 'ok' | 'info' | 'error'; texto: string } | null>(null);

  useEffect(() => {
    import('@/services/pdfReportService').then(m => m.listarPDFs()).then(setPdfs).catch(console.warn);
  }, []);

  useEffect(() => {
    async function cargar() {
      setCargando(true);
      const now = new Date();
      let actual: MesData, anterior: MesData;

      if (periodo === 'diario') {
        const hoy = now.toISOString().slice(0, 10);
        const ayerD = new Date(now); ayerD.setDate(ayerD.getDate() - 1);
        const ayer = ayerD.toISOString().slice(0, 10);
        [actual, anterior] = await Promise.all([getDataRango(hoy, hoy), getDataRango(ayer, ayer)]);
      } else if (periodo === 'semanal') {
        const dow = now.getDay() || 7;
        const lunes = new Date(now); lunes.setDate(now.getDate() - dow + 1);
        const domingo = new Date(lunes); domingo.setDate(lunes.getDate() + 6);
        const lunesAnt = new Date(lunes); lunesAnt.setDate(lunes.getDate() - 7);
        const domingoAnt = new Date(lunesAnt); domingoAnt.setDate(lunesAnt.getDate() + 6);
        [actual, anterior] = await Promise.all([
          getDataRango(lunes.toISOString().slice(0, 10), domingo.toISOString().slice(0, 10)),
          getDataRango(lunesAnt.toISOString().slice(0, 10), domingoAnt.toISOString().slice(0, 10)),
        ]);
      } else {
        const mesActual = now.toISOString().slice(0, 7);
        const anio = now.getFullYear(); const mesNum = now.getMonth() + 1;
        const mesAnterior = mesNum === 1 ? `${anio - 1}-12` : `${anio}-${String(mesNum - 1).padStart(2, '0')}`;
        [actual, anterior] = await Promise.all([getDataMes(mesActual), getDataMes(mesAnterior)]);
      }

      const planGuardado = await getConfig('plan_activo');
      setDataActual(actual);
      setDataAnterior(anterior);
      if (planGuardado) {
        try { setPlan(JSON.parse(planGuardado)); setPlanActivo(true); } catch { console.warn('[reportes] Error parseando plan guardado'); }
      }
      setCargando(false);
    }
    cargar();
  }, [periodo]);

  const mesActualNombre = useMemo(() => {
    return new Date().toLocaleString('es-PY', { month: 'long' });
  }, []);

  const mesAnteriorNombre = useMemo(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1);
    return d.toLocaleString('es-PY', { month: 'long' });
  }, []);

  const hdrSubtitulo = periodo === 'diario' ? 'Tu hoy, en datos' : periodo === 'semanal' ? 'Tu semana, en datos' : `Tu ${mesActualNombre}, en datos`;
  const labelActual = periodo === 'diario' ? 'Hoy' : periodo === 'semanal' ? 'Esta semana' : mesActualNombre;
  const labelAnterior = periodo === 'diario' ? 'Ayer' : periodo === 'semanal' ? 'Sem. anterior' : mesAnteriorNombre;
  const shortActual = periodo === 'diario' ? 'Hoy' : periodo === 'semanal' ? 'Act.' : mesActualNombre.slice(0, 3);
  const shortAnterior = periodo === 'diario' ? 'Ayer' : periodo === 'semanal' ? 'Ant.' : mesAnteriorNombre.slice(0, 3);

  const neto = (dataActual?.ingresos ?? 0) - (dataActual?.egresos ?? 0);
  const pctGastado = dataActual?.ingresos
    ? Math.round((dataActual.egresos / dataActual.ingresos) * 100)
    : 0;

  const maxBar = Math.max(
    dataActual?.ingresos ?? 0,
    dataActual?.egresos  ?? 0,
    dataAnterior?.ingresos ?? 0,
    dataAnterior?.egresos  ?? 0,
    1,
  );

  const insight = useMemo(() => {
    if (!dataActual || !dataAnterior || dataActual.topCats.length === 0) return null;
    const top  = dataActual.topCats[0];
    const prev = dataAnterior.topCats.find(c => c.categoriaId === top.categoriaId);
    const variacion = prev?.total ? ((top.total - prev.total) / prev.total) * 100 : 0;
    return { top, prev, variacion };
  }, [dataActual, dataAnterior]);

  async function handleGenerarPDF() {
    setGenerando(true);
    setPdfMsg(null);
    try {
      if (!dataActual || (dataActual.ingresos === 0 && dataActual.egresos === 0)) {
        setPdfMsg({ tipo: 'info', texto: 'Aún no hay movimientos este mes.' });
        return;
      }
      const pdfService = await import('@/services/pdfReportService');
      const now = new Date();
      const mesKey = now.toISOString().slice(0, 7);
      const anio = now.getFullYear();
      const mesNum = now.getMonth() + 1;
      const mesAntKey = mesNum === 1
        ? `${anio - 1}-12`
        : `${anio}-${String(mesNum - 1).padStart(2, '0')}`;
      const [rpt, rptAnt] = await Promise.all([
        Promise.resolve().then(() => generarReporteMensual(mesKey)),
        Promise.resolve().then(() => generarReporteMensual(mesAntKey)),
      ]);
      const txs = await getTransacciones({
        desde: `${mesKey}-01T00:00:00`,
        hasta: `${mesKey}-${String(new Date(anio, mesNum, 0).getDate()).padStart(2, '0')}T23:59:59`,
        limite: 5000,
      });
      const path = await pdfService.generarPDF(rpt, txs, rptAnt);
      setPdfs(prev => [{ path, name: `reporte-${mesKey}.pdf`, size: 0 }, ...prev]);
      setPdfMsg({ tipo: 'ok', texto: 'PDF generado correctamente.' });
    } catch (e) {
      const esNativo = (e + '').includes('ExpoPrint') || (e + '').includes('native module');
      setPdfMsg({
        tipo: 'error',
        texto: esNativo
          ? 'Esta función requiere EAS Build.'
          : 'No se pudo generar el PDF.',
      });
    } finally {
      setGenerando(false);
    }
  }

  if (cargando) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={t.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }} showsVerticalScrollIndicator={false}>

        {/* ── Header ── */}
        <View style={s.hdr}>
          <Text style={s.hdrLbl}>Reportes</Text>
          <Text style={s.hdrTitle}>{hdrSubtitulo}</Text>
        </View>

        {/* ── Tabs período ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 14, gap: 6, flexDirection: 'row' }}>
          {PERIODOS.map(p => {
            const on = periodo === p.id;
            return (
              <TouchableOpacity key={p.id} style={[s.tab, on && s.tabOn]} onPress={() => setPeriodo(p.id)}>
                <Text style={[s.tabLbl, on && s.tabLblOn]}>{p.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={s.cards}>

          {/* ── Resultado neto ── */}
          <View style={s.card}>
            <Text style={s.netoLbl}>Resultado neto</Text>
            <Text style={[s.netoVal, { color: neto >= 0 ? t.positive : t.negative }]}>
              {neto >= 0 ? '+' : '−'}{fmtGsPlano(neto)}
            </Text>
            <Text style={s.netoMeta}>
              Ingresos {fmtGs(dataActual?.ingresos ?? 0)} · Egresos {fmtGs(dataActual?.egresos ?? 0)} · {pctGastado}% gastado
            </Text>
          </View>

          {/* ── Ingresos vs Egresos (barras horizontales) ── */}
          {dataActual && dataAnterior && (
            <View style={s.card}>
              <Text style={s.cardTitle}>Ingresos vs egresos</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: t.ink3 }} />
                  <Text style={s.legLbl}>{labelAnterior}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: t.accent }} />
                  <Text style={s.legLbl}>{labelActual}</Text>
                </View>
              </View>

              <View style={{ gap: 12 }}>
                <View>
                  <Text style={s.barGroupLbl}>Ingresos</Text>
                  <View style={s.barRow}>
                    <Text style={[s.barRowLbl, { color: t.ink3 }]}>{shortAnterior}</Text>
                    <View style={s.barTrack}>
                      <View style={[s.barFill, { width: `${(dataAnterior.ingresos / maxBar) * 100}%`, backgroundColor: t.ink3 }]} />
                    </View>
                    <Text style={[s.barVal, { color: t.ink3 }]}>{fmtGs(dataAnterior.ingresos)}</Text>
                  </View>
                  <View style={[s.barRow, { marginTop: 5 }]}>
                    <Text style={[s.barRowLbl, { color: t.positive }]}>{shortActual}</Text>
                    <View style={s.barTrack}>
                      <View style={[s.barFill, { width: `${(dataActual.ingresos / maxBar) * 100}%`, backgroundColor: t.positive }]} />
                    </View>
                    <Text style={[s.barVal, { color: t.positive }]}>{fmtGs(dataActual.ingresos)}</Text>
                  </View>
                </View>

                <View style={{ height: 0.5, backgroundColor: t.hairline }} />

                <View>
                  <Text style={s.barGroupLbl}>Egresos</Text>
                  <View style={s.barRow}>
                    <Text style={[s.barRowLbl, { color: t.ink3 }]}>{shortAnterior}</Text>
                    <View style={s.barTrack}>
                      <View style={[s.barFill, { width: `${(dataAnterior.egresos / maxBar) * 100}%`, backgroundColor: t.ink3 }]} />
                    </View>
                    <Text style={[s.barVal, { color: t.ink3 }]}>{fmtGs(dataAnterior.egresos)}</Text>
                  </View>
                  <View style={[s.barRow, { marginTop: 5 }]}>
                    <Text style={[s.barRowLbl, { color: t.negative }]}>{shortActual}</Text>
                    <View style={s.barTrack}>
                      <View style={[s.barFill, { width: `${(dataActual.egresos / maxBar) * 100}%`, backgroundColor: t.negative }]} />
                    </View>
                    <Text style={[s.barVal, { color: t.negative }]}>{fmtGs(dataActual.egresos)}</Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* ── Adónde se fue tu plata ── */}
          {dataActual && dataActual.topCats.length > 0 && (
            <View style={s.card}>
              <Text style={s.cardTitle}>Adónde se fue tu plata</Text>
              {dataActual.topCats.slice(0, 6).map((item, idx, arr) => {
                const cat = CATEGORIA_POR_ID[item.categoriaId];
                const tinte = cat?.tinte ?? t.accent;
                const bgIcon = dark ? `${tinte}28` : `${tinte}20`;
                return (
                  <View key={item.categoriaId} style={{ marginBottom: idx < arr.length - 1 ? 12 : 0 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={[s.catIcon, { backgroundColor: bgIcon }]}>
                          <Icon name={cat?.icono ?? 'circle'} size={12} color={tinte} />
                        </View>
                        <View>
                          <Text style={s.catNombre}>{cat?.nombre ?? item.categoriaId}</Text>
                          <Text style={s.catPct}>{Math.round(item.pct)}%</Text>
                        </View>
                      </View>
                      <Text style={[s.catAmt, { color: t.negative }]}>−{fmtGsPlano(item.total)}</Text>
                    </View>
                    <View style={s.catBarTrack}>
                      <View style={[s.catBarFill, { width: `${item.pct}%`, backgroundColor: tinte }]} />
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* ── Insight del asesor ── */}
          {insight && dataActual && (
            <View style={[s.card, { backgroundColor: `${t.accent}0a`, borderColor: `${t.accent}25` }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <View style={[s.catIcon, { backgroundColor: `${t.accent}20` }]}>
                  <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                    <Path d="M12 2a10 10 0 100 20 10 10 0 000-20zM12 16v-4M12 8h.01"
                      stroke={t.accent} strokeWidth={2} strokeLinecap="round" />
                  </Svg>
                </View>
                <Text style={{ fontSize: 13, fontWeight: '600', color: t.accent }}>Tu asesor nota</Text>
              </View>
              <Text style={{ fontSize: 13.5, lineHeight: 20, color: t.ink, marginBottom: 12 }}>
                {insight.variacion > 10
                  ? `Gastaste ${Math.round(insight.variacion)}% más en ${CATEGORIA_POR_ID[insight.top.categoriaId]?.nombre?.toLowerCase() ?? 'esta categoría'} que el mes pasado.`
                  : insight.variacion < -10
                  ? `Redujiste ${Math.round(Math.abs(insight.variacion))}% en ${CATEGORIA_POR_ID[insight.top.categoriaId]?.nombre?.toLowerCase() ?? 'esta categoría'} vs el mes anterior.`
                  : `Tus ingresos cubren bien tus gastos este mes. Seguí así.`
                }
              </Text>
              {!planActivo ? (
                <TouchableOpacity
                  style={s.accentBtn}
                  onPress={() => {
                    const top = dataActual.topCats[0];
                    if (!top) return;
                    setPlan({ categoria: top.categoriaId, limite: Math.round(top.total * 0.8), actual: top.total });
                    setPlanModal(true);
                  }}
                >
                  <Text style={s.accentBtnLbl}>Ver plan completo</Text>
                </TouchableOpacity>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: t.positive, alignItems: 'center', justifyContent: 'center' }}>
                    <Svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke={colorsDark.bg} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                      <Path d="M20 6L9 17l-5-5" />
                    </Svg>
                  </View>
                  <Text style={{ fontSize: 12, color: t.positive, fontWeight: '500' }}>Plan activo en tu panel</Text>
                </View>
              )}
            </View>
          )}

          {/* ── PDF ── */}
          <View style={s.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke={t.accent} strokeWidth={1.7} fill="none" />
                <Path d="M14 2v6h6M16 13H8M16 17H8" stroke={t.accent} strokeWidth={1.7} strokeLinecap="round" fill="none" />
              </Svg>
              <Text style={{ fontSize: 13, fontWeight: '600', color: t.accent }}>Reporte mensual PDF</Text>
            </View>

            <View style={s.pdfStats}>
              <View style={s.pdfStat}>
                <Text style={s.pdfStatLbl}>Ingresos</Text>
                <Text style={[s.pdfStatVal, { color: t.positive }]}>{fmtGs(dataActual?.ingresos ?? 0)}</Text>
              </View>
              <View style={s.pdfStat}>
                <Text style={s.pdfStatLbl}>Egresos</Text>
                <Text style={[s.pdfStatVal, { color: t.negative }]}>{fmtGs(dataActual?.egresos ?? 0)}</Text>
              </View>
              <View style={s.pdfStat}>
                <Text style={s.pdfStatLbl}>Neto</Text>
                <Text style={[s.pdfStatVal, { color: t.ink2 }]}>{fmtGs(Math.abs(neto))}</Text>
              </View>
            </View>

            {pdfMsg && (
              <View style={{
                paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, marginBottom: 10,
                backgroundColor: pdfMsg.tipo === 'ok' ? `${t.positive}12` : pdfMsg.tipo === 'error' ? `${t.negative}12` : `${t.accent}10`,
                borderWidth: 1,
                borderColor: pdfMsg.tipo === 'ok' ? `${t.positive}30` : pdfMsg.tipo === 'error' ? `${t.negative}30` : `${t.accent}20`,
              }}>
                <Text style={{ fontSize: 12, color: pdfMsg.tipo === 'ok' ? t.positive : pdfMsg.tipo === 'error' ? t.negative : t.accent }}>
                  {pdfMsg.texto}
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[s.genBtn, { opacity: generando ? 0.6 : 1 }]}
              onPress={handleGenerarPDF}
              disabled={generando}
            >
              <Text style={s.genBtnLbl}>{generando ? 'Generando...' : 'Generar PDF mensual'}</Text>
            </TouchableOpacity>

            {pdfs.length > 0 && (
              <View style={{ marginTop: 12, gap: 6 }}>
                <Text style={{ fontSize: 10, fontWeight: '600', color: t.ink3, textTransform: 'uppercase', letterSpacing: 0.5 }}>PDFs guardados</Text>
                {pdfs.map(p => (
                  <TouchableOpacity
                    key={p.name}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingHorizontal: 8, borderRadius: 6, backgroundColor: t.surface }}
                    onPress={async () => {
                      try {
                        const svc = await import('@/services/pdfReportService');
                        await svc.compartirPDF(p.path);
                      } catch {
                        setPdfMsg({ tipo: 'error', texto: 'Compartir requiere la app nativa.' });
                      }
                    }}
                  >
                    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
                      <Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke={t.accent} strokeWidth={1.7} fill="none" />
                      <Path d="M14 2v6h6" stroke={t.accent} strokeWidth={1.7} fill="none" />
                    </Svg>
                    <Text style={{ flex: 1, fontSize: 12, color: t.ink }}>{p.name}</Text>
                    <Text style={{ fontSize: 11, color: t.accent, fontWeight: '600' }}>Compartir</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

        </View>

        {/* ── Modal plan ── */}
        <Modal visible={planModal} transparent animationType="fade" onRequestClose={() => setPlanModal(false)}>
          <View style={s.modalOverlay}>
            <View style={s.modalCard}>
              <Text style={s.modalTitulo}>Plan sugerido</Text>
              <Text style={{ fontSize: 13, color: t.ink2, lineHeight: 18, marginBottom: 12 }}>
                Reducir gasto en{' '}
                <Text style={{ fontWeight: '700' }}>{CATEGORIA_POR_ID[plan?.categoria ?? '']?.nombre ?? 'esta categoría'}</Text>.
              </Text>
              {[
                { label: 'Gasto actual', val: fmtGsPlano(plan?.actual ?? 0), color: t.ink },
                { label: 'Límite sugerido', val: fmtGsPlano(plan?.limite ?? 0), color: t.positive },
                { label: 'Ahorro potencial', val: fmtGsPlano((plan?.actual ?? 0) - (plan?.limite ?? 0)), color: t.accent },
              ].map(row => (
                <View key={row.label} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
                  <Text style={{ fontSize: 13, color: t.ink3 }}>{row.label}</Text>
                  <Text style={{ fontSize: 13, fontWeight: '700', fontFamily: 'GeistMono', color: row.color }}>{row.val}</Text>
                </View>
              ))}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                <TouchableOpacity
                  style={[s.modalBtn, { backgroundColor: t.surface, flex: 1 }]}
                  onPress={() => setPlanModal(false)}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: t.ink2 }}>Rechazar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.modalBtn, { backgroundColor: t.accent, flex: 1 }]}
                  onPress={async () => {
                    if (plan) { await setConfig('plan_activo', JSON.stringify(plan)); setPlanActivo(true); }
                    setPlanModal(false);
                  }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colorsDark.bg }}>Realizar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

      </ScrollView>
    </SafeAreaView>
  );
}

function useStyles(t: typeof colors) {
  return StyleSheet.create({
    hdr: {
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 12,
    },
    hdrLbl: {
      fontSize: 10,
      fontWeight: '600',
      color: t.ink3,
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginBottom: 2,
    },
    hdrTitle: {
      fontSize: 26,
      fontFamily: 'Newsreader-Italic',
      color: t.ink,
      letterSpacing: -0.3,
      lineHeight: 32,
    },
    tab: {
      paddingHorizontal: 16,
      paddingVertical: 7,
      borderRadius: 20,
      borderWidth: 0.5,
      borderColor: t.hairline,
      backgroundColor: 'transparent',
    },
    tabOn: {
      backgroundColor: t.accent,
      borderColor: t.accent,
    },
    tabLbl: {
      fontSize: 12,
      color: t.ink3,
      fontWeight: '500',
    },
    tabLblOn: {
      color: colorsDark.bg,
      fontWeight: '600',
    },
    cards: {
      paddingHorizontal: 16,
      gap: 10,
    },
    card: {
      backgroundColor: t.card,
      borderRadius: 14,
      padding: 16,
      borderWidth: 0.5,
      borderColor: t.hairline,
    },
    netoLbl: {
      fontSize: 10,
      fontWeight: '600',
      color: t.ink3,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 6,
    },
    netoVal: {
      fontSize: 32,
      fontWeight: '700',
      fontFamily: 'GeistMono',
      letterSpacing: -0.5,
      marginBottom: 6,
    },
    netoMeta: {
      fontSize: 11.5,
      color: t.ink3,
      lineHeight: 17,
    },
    cardTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: t.ink,
      marginBottom: 10,
    },
    legLbl: {
      fontSize: 11,
      color: t.ink3,
    },
    barGroupLbl: {
      fontSize: 10,
      color: t.ink3,
      marginBottom: 5,
    },
    barRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    barRowLbl: {
      fontSize: 10,
      width: 28,
      flexShrink: 0,
    },
    barTrack: {
      flex: 1,
      height: 7,
      backgroundColor: t.hairline,
      borderRadius: 4,
      overflow: 'hidden',
    },
    barFill: {
      height: '100%',
      borderRadius: 4,
    },
    barVal: {
      fontSize: 10,
      width: 44,
      textAlign: 'right',
      flexShrink: 0,
    },
    catIcon: {
      width: 24,
      height: 24,
      borderRadius: 6,
      alignItems: 'center',
      justifyContent: 'center',
    },
    catNombre: {
      fontSize: 12.5,
      fontWeight: '500',
      color: t.ink,
    },
    catPct: {
      fontSize: 10.5,
      color: t.ink3,
    },
    catAmt: {
      fontSize: 12,
      fontWeight: '500',
      fontFamily: 'GeistMono',
    },
    catBarTrack: {
      height: 4,
      backgroundColor: t.hairline,
      borderRadius: 2,
      overflow: 'hidden',
    },
    catBarFill: {
      height: '100%',
      borderRadius: 2,
    },
    accentBtn: {
      alignSelf: 'flex-start',
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 8,
      backgroundColor: t.accent,
    },
    accentBtnLbl: {
      fontSize: 12.5,
      fontWeight: '600',
      color: colorsDark.bg,
    },
    pdfStats: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 12,
    },
    pdfStat: {
      flex: 1,
      backgroundColor: t.surface,
      borderRadius: 8,
      padding: 10,
    },
    pdfStatLbl: {
      fontSize: 9,
      color: t.ink3,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 3,
    },
    pdfStatVal: {
      fontSize: 13,
      fontWeight: '600',
      fontFamily: 'GeistMono',
    },
    genBtn: {
      width: '100%',
      paddingVertical: 12,
      borderRadius: 10,
      backgroundColor: t.accent,
      alignItems: 'center',
    },
    genBtnLbl: {
      fontSize: 13,
      fontWeight: '600',
      color: colorsDark.bg,
      letterSpacing: 0.1,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 32,
    },
    modalCard: {
      width: '100%',
      backgroundColor: t.card,
      borderRadius: 16,
      padding: 22,
    },
    modalTitulo: {
      fontSize: 17,
      fontWeight: '700',
      color: t.ink,
      marginBottom: 6,
    },
    modalBtn: {
      paddingVertical: 12,
      borderRadius: 10,
      alignItems: 'center',
    },
  });
}
