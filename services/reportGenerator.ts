/**
 * reportGenerator
 * Responsabilidad: Genera reportes diarios, semanales y mensuales sin filas archivadas
 * Usado por: pdfReportService, reportes
 * Depende de: database, categories, banks, totales, dateKeys
 */
import { getDB, getReporteCache, setReporteCache } from './database';
import { CATEGORIA_POR_ID } from '@/constants/categories';
import { BANCO_POR_ID } from '@/constants/banks';
import { agregarMovimientos } from '@/services/totales';
import { localDateKey, localMonthKey } from '@/services/dateKeys';
import type { FilaAgregable } from '@/services/totales';

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
  return localDateKey(d);
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

  const rows = db.getAllSync<FilaAgregable>(
    `SELECT monto AS monto, date(fecha) AS fecha, archivado AS archivado,
            categoria_id AS categoriaId, banco_id AS bancoId
     FROM transacciones WHERE date(fecha) = ?`,
    [dia],
  );

  const agregado = agregarMovimientos(rows);
  const topCategoriaRow = agregado.porCategoria[0];
  const topCategoria = topCategoriaRow
    ? {
        id: topCategoriaRow.id,
        nombre: CATEGORIA_POR_ID[topCategoriaRow.id]?.nombre ?? topCategoriaRow.id,
        total: topCategoriaRow.total,
      }
    : null;

  const ayer = new Date(`${dia}T12:00:00`);
  ayer.setDate(ayer.getDate() - 1);
  const ayerStr = isoFecha(ayer);
  const ayerRow = db.getFirstSync<{ total: number }>(
    'SELECT COALESCE(SUM(ABS(monto)), 0) AS total FROM transacciones WHERE date(fecha) = ? AND monto < 0 AND archivado = 0',
    [ayerStr],
  );
  const egresosAyer = ayerRow?.total ?? 0;
  const comparacion = egresosAyer > 0 ? Math.round(((agregado.egresos - egresosAyer) / egresosAyer) * 100) : null;

  const reporte: ReporteDiario = {
    tipo: 'diario', fecha: dia,
    totalIngresos: agregado.ingresos, totalEgresos: agregado.egresos,
    saldoNeto: agregado.ingresos - agregado.egresos, transacciones: agregado.conteo,
    topCategoria, comparacionAyer: comparacion,
  };

  setReporteCache('diario', dia, JSON.stringify(reporte));
  return reporte;
}

export function generarReporteSemanal(semana?: string): ReporteSemanal {
  const db  = getDB();
  const hoy = new Date();
  const lunes = semana
    ? (() => { 
        const [year, week] = semana.split('-W').map(Number);
        const d = new Date(year, 0, 1 + (week - 1) * 7);
        return lunesdeSemana(d); 
      })()
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

  const rows = db.getAllSync<FilaAgregable>(
    `SELECT date(fecha) AS fecha, monto AS monto, archivado AS archivado,
            categoria_id AS categoriaId, banco_id AS bancoId
     FROM transacciones WHERE date(fecha) BETWEEN ? AND ?`,
    [fechaInicio, fechaFin],
  );

  const agregado = agregarMovimientos(rows);
  const egresosPorDia = new Map(agregado.porDia.map((d) => [d.fecha, d.egreso]));

  const topCategorias = agregado.porCategoria.slice(0, 5)
    .map(({ id, total }) => ({ id, total, nombre: CATEGORIA_POR_ID[id]?.nombre ?? id }));

  const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const promediosDiarios = DIAS.map((dia, i) => {
    const d = new Date(lunes); d.setDate(lunes.getDate() + i);
    return { dia, total: egresosPorDia.get(isoFecha(d)) ?? 0 };
  });

  const lunesAnterior = new Date(lunes); lunesAnterior.setDate(lunes.getDate() - 7);
  const domingoAnterior = new Date(lunesAnterior); domingoAnterior.setDate(lunesAnterior.getDate() + 6);
  const prevRow = db.getFirstSync<{ total: number }>(
    'SELECT COALESCE(SUM(ABS(monto)), 0) AS total FROM transacciones WHERE date(fecha) BETWEEN ? AND ? AND monto < 0 AND archivado = 0',
    [isoFecha(lunesAnterior), isoFecha(domingoAnterior)],
  );
  const egresosPrev = prevRow?.total ?? 0;
  const comparacion = egresosPrev > 0 ? Math.round(((agregado.egresos - egresosPrev) / egresosPrev) * 100) : null;

  const reporte: ReporteSemanal = {
    tipo: 'semanal', semana: clave, fechaInicio, fechaFin,
    totalIngresos: agregado.ingresos, totalEgresos: agregado.egresos,
    saldoNeto: agregado.ingresos - agregado.egresos,
    diasConMovimientos: agregado.diasConMovimientos, topCategorias, promediosDiarios,
    comparacionSemanaAnterior: comparacion,
  };

  setReporteCache('semanal', clave, JSON.stringify(reporte));
  return reporte;
}

export function generarReporteMensual(mes?: string): ReporteMensual {
  const db  = getDB();
  const key = mes ?? localMonthKey(new Date());

  const cached = getReporteCache('mensual', key);
  if (cached) {
    try { return JSON.parse(cached) as ReporteMensual; } catch { console.warn('[ReportGen] Cache parse error'); }
  }

  const rows = db.getAllSync<FilaAgregable>(
    `SELECT date(fecha) AS fecha, monto AS monto, archivado AS archivado,
            categoria_id AS categoriaId, banco_id AS bancoId
     FROM transacciones WHERE strftime('%Y-%m', fecha) = ?`,
    [key],
  );

  const agregado = agregarMovimientos(rows);

  const totalEgresosParaPct = agregado.egresos || 1;
  const topCategorias = agregado.porCategoria.slice(0, 6)
    .map(({ id, total }) => ({ id, total, nombre: CATEGORIA_POR_ID[id]?.nombre ?? id, pct: Math.round((total / totalEgresosParaPct) * 100) }));

  const topBancos = agregado.porBanco.slice(0, 4)
    .map(({ id, total }) => ({ bancoId: id, total, nombre: BANCO_POR_ID[id]?.nombre ?? id }));

  const maxGastoDia = agregado.porDia.reduce<{ fecha: string; total: number } | null>(
    (maximo, dia) => (maximo === null || dia.egreso > maximo.total ? { fecha: dia.fecha, total: dia.egreso } : maximo),
    null,
  );

  const diasActivos = agregado.diasConMovimientos;
  const promedioGastoDiario = diasActivos > 0 ? Math.round(agregado.egresos / diasActivos) : 0;

  const [anio, numMes] = key.split('-').map(Number);
  const mesAnteriorDate = new Date(anio, numMes - 2, 1);
  const mesAnteriorKey  = localMonthKey(mesAnteriorDate);
  const prevRow = db.getFirstSync<{ total: number }>(
    'SELECT COALESCE(SUM(ABS(monto)), 0) AS total FROM transacciones WHERE strftime(\'%Y-%m\', fecha) = ? AND monto < 0 AND archivado = 0',
    [mesAnteriorKey],
  );
  const egresosPrev = prevRow?.total ?? 0;
  const comparacion = egresosPrev > 0 ? Math.round(((agregado.egresos - egresosPrev) / egresosPrev) * 100) : null;

  const reporte: ReporteMensual = {
    tipo: 'mensual', mes: key, nombreMes: nombreMesEsp(key),
    totalIngresos: agregado.ingresos, totalEgresos: agregado.egresos,
    saldoNeto: agregado.ingresos - agregado.egresos,
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
