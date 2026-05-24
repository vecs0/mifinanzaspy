// services/reportGenerator.ts — Generador de reportes automáticos diario/semanal/mensual
// Los reportes se calculan desde la DB SQLite y se cachean en la tabla reportes_cache.
// Los datos son 100% offline: no se envían a ningún servidor.

import { getDB } from './database';
import { CATEGORIA_POR_ID } from '@/constants/categories';
import { BANCO_POR_ID } from '@/constants/banks';
import type {
  ResumenDiario,
  ResumenMensual,
  TipoReporte,
  ReporteCache,
} from '@/types/finance';

// ─── Tipos de reporte expandidos ─────────────────────────────────

export interface ReporteDiario {
  tipo:           'diario';
  fecha:          string;             // "2026-05-23"
  totalIngresos:  number;
  totalEgresos:   number;
  saldoNeto:      number;
  transacciones:  number;             // Cantidad de movimientos
  topCategoria:   { id: string; nombre: string; total: number } | null;
  comparacionAyer: number | null;     // Diferencia % vs ayer (null si no hay datos)
}

export interface ReporteSemanal {
  tipo:           'semanal';
  semana:         string;             // "2026-W21"
  fechaInicio:    string;             // Lunes de la semana
  fechaFin:       string;             // Domingo
  totalIngresos:  number;
  totalEgresos:   number;
  saldoNeto:      number;
  diasConMovimientos: number;
  topCategorias:  { id: string; nombre: string; total: number }[];
  promediosDiarios: { dia: string; total: number }[];
  comparacionSemanaAnterior: number | null;
}

export interface ReporteMensual {
  tipo:                'mensual';
  mes:                 string;        // "2026-05"
  nombreMes:           string;        // "Mayo 2026"
  totalIngresos:       number;
  totalEgresos:        number;
  saldoNeto:           number;
  topCategorias:       { id: string; nombre: string; total: number; pct: number }[];
  topBancos:           { bancoId: string; nombre: string; total: number }[];
  comparacionMesAnterior: number | null;
  diasActivos:         number;
  promedioGastoDiario: number;
  maxGastoDia:         { fecha: string; total: number } | null;
}

// ─── Helpers ─────────────────────────────────────────────────────

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
  // Calcular número de semana ISO
  const temp = new Date(d.valueOf());
  const day  = (d.getDay() + 6) % 7; // Lunes = 0
  temp.setDate(temp.getDate() - day + 3);
  const first = new Date(temp.getFullYear(), 0, 4);
  const week  = 1 + Math.round(((temp.getTime() - first.getTime()) / 86400000 - 3 + (first.getDay() + 6) % 7) / 7);
  return `${temp.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

function lunesdeSemana(d: Date): Date {
  const r = new Date(d);
  const day = r.getDay();
  const diff = (day + 6) % 7; // días desde el lunes
  r.setDate(r.getDate() - diff);
  r.setHours(0, 0, 0, 0);
  return r;
}

// ─── Reporte diario ───────────────────────────────────────────────

export async function generarReporteDiario(fecha?: string): Promise<ReporteDiario> {
  const db = await getDB();
  const dia = fecha ?? isoFecha(new Date());

  const rows = await db.getAllAsync<{
    tipo: string; monto: number; categoriaId: string;
  }>(
    `SELECT tipo, monto, categoriaId
     FROM transacciones
     WHERE date(fecha) = ? AND procesado = 1`,
    [dia],
  );

  let ingresos = 0;
  let egresos  = 0;
  const catMap: Record<string, number> = {};

  for (const r of rows) {
    if (r.monto > 0) ingresos += r.monto;
    else             egresos  += Math.abs(r.monto);
    if (r.categoriaId) {
      catMap[r.categoriaId] = (catMap[r.categoriaId] ?? 0) + Math.abs(r.monto);
    }
  }

  // Top categoría del día
  const topCatEntry = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0];
  const topCategoria = topCatEntry
    ? {
        id:     topCatEntry[0],
        nombre: CATEGORIA_POR_ID[topCatEntry[0]]?.nombre ?? topCatEntry[0],
        total:  topCatEntry[1],
      }
    : null;

  // Comparación con ayer
  const ayer = new Date(dia);
  ayer.setDate(ayer.getDate() - 1);
  const ayerStr = isoFecha(ayer);
  const ayerRow = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(ABS(monto)), 0) AS total
     FROM transacciones WHERE date(fecha) = ? AND monto < 0 AND procesado = 1`,
    [ayerStr],
  );
  const egresosAyer = ayerRow?.total ?? 0;
  const comparacion = egresosAyer > 0
    ? Math.round(((egresos - egresosAyer) / egresosAyer) * 100)
    : null;

  const reporte: ReporteDiario = {
    tipo: 'diario', fecha: dia,
    totalIngresos: ingresos,
    totalEgresos:  egresos,
    saldoNeto:     ingresos - egresos,
    transacciones: rows.length,
    topCategoria,
    comparacionAyer: comparacion,
  };

  await guardarCache('diario', dia, reporte);
  return reporte;
}

// ─── Reporte semanal ──────────────────────────────────────────────

export async function generarReporteSemanal(semana?: string): Promise<ReporteSemanal> {
  const db   = await getDB();
  const hoy  = new Date();
  const lunes = semana
    ? (() => {
        const d = new Date(semana + '-01'); // Approx; se usa lunes de la semana
        return lunesdeSemana(d);
      })()
    : lunesdeSemana(hoy);

  const domingo = new Date(lunes);
  domingo.setDate(lunes.getDate() + 6);

  const fechaInicio = isoFecha(lunes);
  const fechaFin    = isoFecha(domingo);
  const clave       = semanaClave(lunes);

  const rows = await db.getAllAsync<{
    fecha: string; monto: number; categoriaId: string; bancoId: string;
  }>(
    `SELECT date(fecha) AS fecha, monto, categoriaId, bancoId
     FROM transacciones
     WHERE date(fecha) BETWEEN ? AND ? AND procesado = 1`,
    [fechaInicio, fechaFin],
  );

  let ingresos = 0;
  let egresos  = 0;
  const catMap:  Record<string, number> = {};
  const diaMap:  Record<string, number> = {};
  const diasSet: Set<string>            = new Set();

  for (const r of rows) {
    if (r.monto > 0) ingresos += r.monto;
    else             egresos  += Math.abs(r.monto);
    if (r.categoriaId) catMap[r.categoriaId]  = (catMap[r.categoriaId]  ?? 0) + Math.abs(r.monto);
    if (r.monto < 0)   diaMap[r.fecha]        = (diaMap[r.fecha]        ?? 0) + Math.abs(r.monto);
    if (r.monto !== 0) diasSet.add(r.fecha);
  }

  const topCategorias = Object.entries(catMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, total]) => ({
      id, total, nombre: CATEGORIA_POR_ID[id]?.nombre ?? id,
    }));

  // Promedios por día de la semana
  const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const promediosDiarios = DIAS.map((dia, i) => {
    const d = new Date(lunes); d.setDate(lunes.getDate() + i);
    return { dia, total: diaMap[isoFecha(d)] ?? 0 };
  });

  // Comparación semana anterior
  const lunesAnterior = new Date(lunes); lunesAnterior.setDate(lunes.getDate() - 7);
  const domingoAnterior = new Date(lunesAnterior); domingoAnterior.setDate(lunesAnterior.getDate() + 6);
  const prevRow = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(ABS(monto)), 0) AS total
     FROM transacciones
     WHERE date(fecha) BETWEEN ? AND ? AND monto < 0 AND procesado = 1`,
    [isoFecha(lunesAnterior), isoFecha(domingoAnterior)],
  );
  const egresosPrev = prevRow?.total ?? 0;
  const comparacion = egresosPrev > 0
    ? Math.round(((egresos - egresosPrev) / egresosPrev) * 100)
    : null;

  const reporte: ReporteSemanal = {
    tipo: 'semanal', semana: clave,
    fechaInicio, fechaFin,
    totalIngresos:  ingresos,
    totalEgresos:   egresos,
    saldoNeto:      ingresos - egresos,
    diasConMovimientos: diasSet.size,
    topCategorias,
    promediosDiarios,
    comparacionSemanaAnterior: comparacion,
  };

  await guardarCache('semanal', clave, reporte);
  return reporte;
}

// ─── Reporte mensual ──────────────────────────────────────────────

export async function generarReporteMensual(mes?: string): Promise<ReporteMensual> {
  const db  = await getDB();
  const key = mes ?? new Date().toISOString().slice(0, 7);   // "2026-05"

  const rows = await db.getAllAsync<{
    fecha: string; monto: number; categoriaId: string; bancoId: string;
  }>(
    `SELECT date(fecha) AS fecha, monto, categoriaId, bancoId
     FROM transacciones
     WHERE strftime('%Y-%m', fecha) = ? AND procesado = 1`,
    [key],
  );

  let ingresos = 0;
  let egresos  = 0;
  const catMap:  Record<string, number> = {};
  const bancoMap: Record<string, number> = {};
  const diaMap:  Record<string, number> = {};
  const diasSet: Set<string>            = new Set();

  for (const r of rows) {
    if (r.monto > 0) ingresos += r.monto;
    else             egresos  += Math.abs(r.monto);
    if (r.categoriaId) catMap[r.categoriaId]  = (catMap[r.categoriaId]  ?? 0) + Math.abs(r.monto);
    if (r.bancoId)     bancoMap[r.bancoId]    = (bancoMap[r.bancoId]    ?? 0) + Math.abs(r.monto);
    if (r.monto < 0)   diaMap[r.fecha]        = (diaMap[r.fecha]        ?? 0) + Math.abs(r.monto);
    if (r.monto !== 0) diasSet.add(r.fecha);
  }

  // Top categorías con porcentaje
  const totalEgresosParaPct = egresos || 1;
  const topCategorias = Object.entries(catMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([id, total]) => ({
      id, total,
      nombre: CATEGORIA_POR_ID[id]?.nombre ?? id,
      pct:    Math.round((total / totalEgresosParaPct) * 100),
    }));

  // Top bancos
  const topBancos = Object.entries(bancoMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([bancoId, total]) => ({
      bancoId, total,
      nombre: BANCO_POR_ID[bancoId]?.nombre ?? bancoId,
    }));

  // Día con mayor gasto
  const maxDia = Object.entries(diaMap).sort((a, b) => b[1] - a[1])[0];
  const maxGastoDia = maxDia ? { fecha: maxDia[0], total: maxDia[1] } : null;

  const diasActivos = diasSet.size;
  const promedioGastoDiario = diasActivos > 0 ? Math.round(egresos / diasActivos) : 0;

  // Comparación mes anterior
  const [anio, numMes] = key.split('-').map(Number);
  const mesAnteriorDate = new Date(anio, numMes - 2, 1);
  const mesAnteriorKey  = mesAnteriorDate.toISOString().slice(0, 7);
  const prevRow = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(ABS(monto)), 0) AS total
     FROM transacciones
     WHERE strftime('%Y-%m', fecha) = ? AND monto < 0 AND procesado = 1`,
    [mesAnteriorKey],
  );
  const egresosPrev = prevRow?.total ?? 0;
  const comparacion = egresosPrev > 0
    ? Math.round(((egresos - egresosPrev) / egresosPrev) * 100)
    : null;

  const reporte: ReporteMensual = {
    tipo: 'mensual', mes: key,
    nombreMes:     nombreMesEsp(key),
    totalIngresos: ingresos,
    totalEgresos:  egresos,
    saldoNeto:     ingresos - egresos,
    topCategorias,
    topBancos,
    comparacionMesAnterior: comparacion,
    diasActivos,
    promedioGastoDiario,
    maxGastoDia,
  };

  await guardarCache('mensual', key, reporte);
  return reporte;
}

// ─── Caché en DB ─────────────────────────────────────────────────

async function guardarCache(
  tipo: TipoReporte,
  fecha: string,
  datos: ReporteDiario | ReporteSemanal | ReporteMensual,
): Promise<void> {
  const db = await getDB();
  const json = JSON.stringify(datos);
  await db.runAsync(
    `INSERT OR REPLACE INTO reportes_cache (id, tipo, fecha, contenido_json)
     VALUES (lower(hex(randomblob(8))), ?, ?, ?)`,
    [tipo, fecha, json],
  );
}

/**
 * Lee un reporte del caché. Retorna null si no existe o está desactualizado.
 * maxAgeMinutes: máxima antigüedad del caché en minutos (default: 60).
 */
export async function leerCacheReporte(
  tipo: TipoReporte,
  fecha: string,
  maxAgeMinutes = 60,
): Promise<ReporteDiario | ReporteSemanal | ReporteMensual | null> {
  const db = await getDB();
  const row = await db.getFirstAsync<{ contenido_json: string; created_at: string }>(
    `SELECT contenido_json, created_at FROM reportes_cache
     WHERE tipo = ? AND fecha = ?
     ORDER BY created_at DESC LIMIT 1`,
    [tipo, fecha],
  );
  if (!row) return null;

  // Verificar antigüedad
  const creado = new Date(row.created_at).getTime();
  const ahoraMsAntiguedad = Date.now() - creado;
  if (ahoraMsAntiguedad > maxAgeMinutes * 60_000) return null;

  try {
    return JSON.parse(row.contenido_json);
  } catch {
    return null;
  }
}

// ─── Generación automática periódica ─────────────────────────────

/**
 * Genera (o recupera del caché) todos los reportes del período actual.
 * Llamar desde la app al arrancar o al recibir un nuevo movimiento.
 */
export async function actualizarReportesActuales(): Promise<{
  diario:   ReporteDiario;
  semanal:  ReporteSemanal;
  mensual:  ReporteMensual;
}> {
  const [diario, semanal, mensual] = await Promise.all([
    generarReporteDiario(),
    generarReporteSemanal(),
    generarReporteMensual(),
  ]);
  return { diario, semanal, mensual };
}
