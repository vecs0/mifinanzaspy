/**
 * reportGenerator
 * Responsabilidad: Genera reportes mensuales de ingresos/egresos
 * Usado por: pdfReportService, reportes
 * Depende de: database, categories, banks
 */
import { getDB, getReporteCache, setReporteCache } from './database';
import { CATEGORIA_POR_ID } from '@/constants/categories';
import { BANCO_POR_ID } from '@/constants/banks';

export interface ReporteDiario {
  tipo: 'diario';
  fecha: string;
  totalIngresos: number;
  totalEgresos: number;
  saldoNeto: number;
  transacciones: number;
  topCategoria: { id: string; nombre: string; total: number } | null;
  comparacionAyer: number | null;
}

export interface ReporteSemanal {
  tipo: 'semanal';
  semana: string;
  fechaInicio: string;
  fechaFin: string;
  totalIngresos: number;
  totalEgresos: number;
  saldoNeto: number;
  diasConMovimientos: number;
  topCategorias: { id: string; nombre: string; total: number }[];
  promediosDiarios: { dia: string; total: number }[];
  comparacionSemanaAnterior: number | null;
}

export interface ReporteMensual {
  tipo: 'mensual';
  mes: string;
  nombreMes: string;
  totalIngresos: number;
  totalEgresos: number;
  saldoNeto: number;
  topCategorias: { id: string; nombre: string; total: number; pct: number }[];
  topBancos: { bancoId: string; nombre: string; total: number }[];
  comparacionMesAnterior: number | null;
  diasActivos: number;
  promedioGastoDiario: number;
  maxGastoDia: { fecha: string; total: number } | null;
}

function isoFecha(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function nombreMesEsp(mes: string): string {
  const [anio, m] = mes.split('-');
  const MESES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];
  return `${MESES[parseInt(m, 10) - 1]} ${anio}`;
}

function semanaClave(d: Date): string {
  const temp = new Date(d.valueOf());
  const day  = (d.getDay() + 6) % 7;
  temp.setDate(temp.getDate() - day + 3);
  const first = new Date(temp.getFullYear(), 0, 4);
  const week  = 1 + Math.round(((temp.getTime() - first.getTime()) / 86400000 - 3 + (first.getDay() + 6) % 7) / 7);
  return `${temp.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

function lunesdeSemana(d: Date): Date {
  const r = new Date(d);
  const diff = (r.getDay() + 6) % 7;
  r.setDate(r.getDate() - diff);
  r.setHours(0, 0, 0, 0);
  return r;
}

export function generarReporteDiario(fecha?: string): ReporteDiario {
  const db = getDB();
  const dia = fecha ?? isoFecha(new Date());

  const cached = getReporteCache('diario', dia);
  if (cached) {
    try { return JSON.parse(cached) as ReporteDiario; } catch { console.warn('[ReportGen] Cache parse error'); }
  }

  const rows = db.getAllSync<{ tipo: string; monto: number; categoriaId: string }>(
    `SELECT tipo, monto, categoria_id AS categoriaId
     FROM transacciones WHERE date(fecha) = ? AND procesado = 1`,
    [dia],
  );

  let ingresos = 0;
  let egresos  = 0;
  const catMap: Record<string, number> = {};

  for (const r of rows) {
    if (r.monto > 0) ingresos += r.monto;
    else             egresos  += Math.abs(r.monto);
    if (r.categoriaId) catMap[r.categoriaId] = (catMap[r.categoriaId] ?? 0) + Math.abs(r.monto);
  }

  const topCatEntry = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0];
  const topCategoria = topCatEntry
    ? { id: topCatEntry[0], nombre: CATEGORIA_POR_ID[topCatEntry[0]]?.nombre ?? topCatEntry[0], total: topCatEntry[1] }
    : null;

  const ayer = new Date(dia);
  ayer.setDate(ayer.getDate() - 1);
  const ayerStr = isoFecha(ayer);
  const ayerRow = db.getFirstSync<{ total: number }>(
    'SELECT COALESCE(SUM(ABS(monto)), 0) AS total FROM transacciones WHERE date(fecha) = ? AND monto < 0 AND procesado = 1',
    [ayerStr],
  );
  const egresosAyer = ayerRow?.total ?? 0;
  const comparacion = egresosAyer > 0 ? Math.round(((egresos - egresosAyer) / egresosAyer) * 100) : null;

  const reporte: ReporteDiario = {
    tipo: 'diario', fecha: dia,
    totalIngresos: ingresos, totalEgresos: egresos,
    saldoNeto: ingresos - egresos, transacciones: rows.length,
    topCategoria, comparacionAyer: comparacion,
  };

  setReporteCache('diario', dia, JSON.stringify(reporte));
  return reporte;
}

export function generarReporteSemanal(semana?: string): ReporteSemanal {
  const db  = getDB();
  const hoy = new Date();
  const lunes = semana
    ? (() => { const d = new Date(semana + '-01'); return lunesdeSemana(d); })()
    : lunesdeSemana(hoy);

  const domingo = new Date(lunes);
  domingo.setDate(lunes.getDate() + 6);

  const fechaInicio = isoFecha(lunes);
  const fechaFin    = isoFecha(domingo);
  const clave       = semanaClave(lunes);

  const cached = getReporteCache('semanal', clave);
  if (cached) {
    try { return JSON.parse(cached) as ReporteSemanal; } catch { console.warn('[ReportGen] Cache parse error'); }
  }

  const rows = db.getAllSync<{ fecha: string; monto: number; categoriaId: string; bancoId: string }>(
    `SELECT date(fecha) AS fecha, monto, categoria_id AS categoriaId, banco_id AS bancoId
     FROM transacciones WHERE date(fecha) BETWEEN ? AND ? AND procesado = 1`,
    [fechaInicio, fechaFin],
  );

  let ingresos = 0;
  let egresos  = 0;
  const catMap:  Record<string, number> = {};
  const diaMap:  Record<string, number> = {};
  const diasSet: Set<string> = new Set();

  for (const r of rows) {
    if (r.monto > 0) ingresos += r.monto;
    else             egresos  += Math.abs(r.monto);
    if (r.categoriaId) catMap[r.categoriaId] = (catMap[r.categoriaId] ?? 0) + Math.abs(r.monto);
    if (r.monto < 0)   diaMap[r.fecha] = (diaMap[r.fecha] ?? 0) + Math.abs(r.monto);
    if (r.monto !== 0) diasSet.add(r.fecha);
  }

  const topCategorias = Object.entries(catMap)
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([id, total]) => ({ id, total, nombre: CATEGORIA_POR_ID[id]?.nombre ?? id }));

  const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const promediosDiarios = DIAS.map((dia, i) => {
    const d = new Date(lunes); d.setDate(lunes.getDate() + i);
    return { dia, total: diaMap[isoFecha(d)] ?? 0 };
  });

  const lunesAnterior = new Date(lunes); lunesAnterior.setDate(lunes.getDate() - 7);
  const domingoAnterior = new Date(lunesAnterior); domingoAnterior.setDate(lunesAnterior.getDate() + 6);
  const prevRow = db.getFirstSync<{ total: number }>(
    'SELECT COALESCE(SUM(ABS(monto)), 0) AS total FROM transacciones WHERE date(fecha) BETWEEN ? AND ? AND monto < 0 AND procesado = 1',
    [isoFecha(lunesAnterior), isoFecha(domingoAnterior)],
  );
  const egresosPrev = prevRow?.total ?? 0;
  const comparacion = egresosPrev > 0 ? Math.round(((egresos - egresosPrev) / egresosPrev) * 100) : null;

  const reporte: ReporteSemanal = {
    tipo: 'semanal', semana: clave, fechaInicio, fechaFin,
    totalIngresos: ingresos, totalEgresos: egresos, saldoNeto: ingresos - egresos,
    diasConMovimientos: diasSet.size, topCategorias, promediosDiarios,
    comparacionSemanaAnterior: comparacion,
  };

  setReporteCache('semanal', clave, JSON.stringify(reporte));
  return reporte;
}

export function generarReporteMensual(mes?: string): ReporteMensual {
  const db  = getDB();
  const key = mes ?? new Date().toISOString().slice(0, 7);

  const cached = getReporteCache('mensual', key);
  if (cached) {
    try { return JSON.parse(cached) as ReporteMensual; } catch { console.warn('[ReportGen] Cache parse error'); }
  }

  const rows = db.getAllSync<{ fecha: string; monto: number; categoriaId: string; bancoId: string }>(
    `SELECT date(fecha) AS fecha, monto, categoria_id AS categoriaId, banco_id AS bancoId
     FROM transacciones WHERE strftime('%Y-%m', fecha) = ? AND procesado = 1`,
    [key],
  );

  let ingresos = 0;
  let egresos  = 0;
  const catMap:   Record<string, number> = {};
  const bancoMap: Record<string, number> = {};
  const diaMap:   Record<string, number> = {};
  const diasSet:  Set<string> = new Set();

  for (const r of rows) {
    if (r.monto > 0) ingresos += r.monto;
    else             egresos  += Math.abs(r.monto);
    if (r.categoriaId) catMap[r.categoriaId]  = (catMap[r.categoriaId]  ?? 0) + Math.abs(r.monto);
    if (r.bancoId)     bancoMap[r.bancoId]    = (bancoMap[r.bancoId]    ?? 0) + Math.abs(r.monto);
    if (r.monto < 0)   diaMap[r.fecha]        = (diaMap[r.fecha]        ?? 0) + Math.abs(r.monto);
    if (r.monto !== 0) diasSet.add(r.fecha);
  }

  const totalEgresosParaPct = egresos || 1;
  const topCategorias = Object.entries(catMap)
    .sort((a, b) => b[1] - a[1]).slice(0, 6)
    .map(([id, total]) => ({ id, total, nombre: CATEGORIA_POR_ID[id]?.nombre ?? id, pct: Math.round((total / totalEgresosParaPct) * 100) }));

  const topBancos = Object.entries(bancoMap)
    .sort((a, b) => b[1] - a[1]).slice(0, 4)
    .map(([bancoId, total]) => ({ bancoId, total, nombre: BANCO_POR_ID[bancoId]?.nombre ?? bancoId }));

  const maxDia = Object.entries(diaMap).sort((a, b) => b[1] - a[1])[0];
  const maxGastoDia = maxDia ? { fecha: maxDia[0], total: maxDia[1] } : null;

  const diasActivos = diasSet.size;
  const promedioGastoDiario = diasActivos > 0 ? Math.round(egresos / diasActivos) : 0;

  const [anio, numMes] = key.split('-').map(Number);
  const mesAnteriorDate = new Date(anio, numMes - 2, 1);
  const mesAnteriorKey  = mesAnteriorDate.toISOString().slice(0, 7);
  const prevRow = db.getFirstSync<{ total: number }>(
    'SELECT COALESCE(SUM(ABS(monto)), 0) AS total FROM transacciones WHERE strftime(\'%Y-%m\', fecha) = ? AND monto < 0 AND procesado = 1',
    [mesAnteriorKey],
  );
  const egresosPrev = prevRow?.total ?? 0;
  const comparacion = egresosPrev > 0 ? Math.round(((egresos - egresosPrev) / egresosPrev) * 100) : null;

  const reporte: ReporteMensual = {
    tipo: 'mensual', mes: key, nombreMes: nombreMesEsp(key),
    totalIngresos: ingresos, totalEgresos: egresos, saldoNeto: ingresos - egresos,
    topCategorias, topBancos, comparacionMesAnterior: comparacion,
    diasActivos, promedioGastoDiario, maxGastoDia,
  };

  setReporteCache('mensual', key, JSON.stringify(reporte));
  return reporte;
}

export function actualizarReportesActuales(): {
  diario: ReporteDiario; semanal: ReporteSemanal; mensual: ReporteMensual;
} {
  return {
    diario:  generarReporteDiario(),
    semanal: generarReporteSemanal(),
    mensual: generarReporteMensual(),
  };
}
