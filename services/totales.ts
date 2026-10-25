/**
 * totales
 * Responsabilidad: Funciones puras de agregacion de movimientos (predicados de visibilidad y agregados sin archivados)
 * Usado por: services/database.ts, services/alerts.ts, services/budgets.ts, services/reportGenerator.ts, __tests__/totales.test.ts
 * Depende de: services/dateKeys.ts
 */
import { localDateKey, localLastDaysKeys, storedDayKey } from './dateKeys';

export type FilaMovimiento = {
  monto: number;
  fecha: string;
  esTraspaso: number | null;
  archivado: number | null;
  bancoId: string | null;
  categoriaId: string | null;
  categoriaNombre: string | null;
};

export type FilaAgregable = {
  monto: number;
  fecha: string;
  archivado: number | null;
  categoriaId: string | null;
  bancoId: string | null;
};

export type ResumenMes = {
  ingresos: number;
  egresos: number;
  topCategorias: { id: string; nombre: string; total: number }[];
};

export type GastoBanco = { bancoId: string; total: number };

export type EgresoDia = { fecha: string; total: number };

export type BarraDia = { key: string; dia: string; total: number; esHoy: boolean };

export type AgregadoMovimientos = {
  ingresos: number;
  egresos: number;
  conteo: number;
  porCategoria: { id: string; total: number }[];
  porBanco: { id: string; total: number }[];
  porDia: { fecha: string; egreso: number }[];
  diasConMovimientos: number;
};

export function esComputable(
  fila: Pick<FilaMovimiento, 'esTraspaso'> & { archivado?: number | null }
): boolean {
  return fila.esTraspaso !== 1 && (fila.archivado ?? 0) !== 1;
}

export function esVisible(fila: { archivado?: number | null }): boolean {
  return (fila.archivado ?? 0) !== 1;
}

function compararTotales(a: { total: number }, b: { total: number }, idA: string, idB: string): number {
  if (b.total !== a.total) return b.total - a.total;
  return idA < idB ? -1 : idA > idB ? 1 : 0;
}

export function gastosPorCategoria(
  filas: FilaAgregable[]
): { categoriaId: string; total: number }[] {
  const porCategoria = new Map<string, number>();
  for (const f of filas) {
    if (!esVisible(f) || f.monto >= 0 || !f.categoriaId) continue;
    porCategoria.set(f.categoriaId, (porCategoria.get(f.categoriaId) ?? 0) + -f.monto);
  }
  return Array.from(porCategoria, ([categoriaId, total]) => ({ categoriaId, total })).sort((a, b) =>
    compararTotales(a, b, a.categoriaId, b.categoriaId)
  );
}

export function gastosPorCategoriaMes(
  filas: FilaAgregable[]
): { categoriaId: string; mes: string; total: number }[] {
  const porMesCategoria = new Map<string, { categoriaId: string; mes: string; total: number }>();
  for (const f of filas) {
    if (!esVisible(f) || f.monto >= 0 || !f.categoriaId) continue;
    const mes = storedDayKey(f.fecha).slice(0, 7);
    const clave = `${mes}|${f.categoriaId}`;
    const actual = porMesCategoria.get(clave);
    if (actual) actual.total += -f.monto;
    else porMesCategoria.set(clave, { categoriaId: f.categoriaId, mes, total: -f.monto });
  }
  return Array.from(porMesCategoria.values()).sort(
    (a, b) =>
      (a.mes < b.mes ? -1 : a.mes > b.mes ? 1 : 0) ||
      compararTotales(a, b, a.categoriaId, b.categoriaId)
  );
}

export function totalEgresos(filas: FilaAgregable[]): number {
  let total = 0;
  for (const f of filas) {
    if (!esVisible(f) || f.monto >= 0) continue;
    total += -f.monto;
  }
  return total;
}

export function agregarMovimientos(filas: FilaAgregable[]): AgregadoMovimientos {
  let ingresos = 0;
  let egresos = 0;
  let conteo = 0;
  const porCategoria = new Map<string, number>();
  const porBanco = new Map<string, number>();
  const porDia = new Map<string, number>();
  const dias = new Set<string>();
  for (const f of filas) {
    if (!esVisible(f)) continue;
    conteo++;
    if (f.monto > 0) ingresos += f.monto;
    else if (f.monto < 0) egresos += -f.monto;
    if (f.categoriaId) {
      porCategoria.set(f.categoriaId, (porCategoria.get(f.categoriaId) ?? 0) + Math.abs(f.monto));
    }
    if (f.bancoId) {
      porBanco.set(f.bancoId, (porBanco.get(f.bancoId) ?? 0) + Math.abs(f.monto));
    }
    if (f.monto !== 0) {
      const dia = storedDayKey(f.fecha);
      dias.add(dia);
      if (f.monto < 0) porDia.set(dia, (porDia.get(dia) ?? 0) + -f.monto);
    }
  }
  return {
    ingresos,
    egresos,
    conteo,
    porCategoria: Array.from(porCategoria, ([id, total]) => ({ id, total })).sort((a, b) =>
      compararTotales(a, b, a.id, b.id)
    ),
    porBanco: Array.from(porBanco, ([id, total]) => ({ id, total })).sort((a, b) =>
      compararTotales(a, b, a.id, b.id)
    ),
    porDia: Array.from(porDia, ([fecha, egreso]) => ({ fecha, egreso })).sort((a, b) =>
      a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0
    ),
    diasConMovimientos: dias.size,
  };
}

export function calcularResumenMes(
  filas: FilaMovimiento[],
  mes: string,
  limiteTop: number
): ResumenMes {
  let ingresos = 0;
  let egresos = 0;
  const porCat = new Map<string, { id: string; nombre: string; total: number }>();
  for (const f of filas) {
    if (!esComputable(f) || storedDayKey(f.fecha).slice(0, 7) !== mes) continue;
    if (f.monto > 0) {
      ingresos += f.monto;
    } else if (f.monto < 0) {
      egresos += -f.monto;
      if (f.categoriaId && f.categoriaNombre) {
        const actual = porCat.get(f.categoriaId);
        if (actual) actual.total += -f.monto;
        else porCat.set(f.categoriaId, { id: f.categoriaId, nombre: f.categoriaNombre, total: -f.monto });
      }
    }
  }
  const topCategorias = Array.from(porCat.values())
    .sort((a, b) => b.total - a.total || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .slice(0, Math.max(0, limiteTop));
  return { ingresos, egresos, topCategorias };
}

export function calcularGastosPorBanco(filas: FilaMovimiento[], mes: string): GastoBanco[] {
  const porBanco = new Map<string, number>();
  for (const f of filas) {
    if (!esComputable(f) || f.monto >= 0 || !f.bancoId) continue;
    if (storedDayKey(f.fecha).slice(0, 7) !== mes) continue;
    porBanco.set(f.bancoId, (porBanco.get(f.bancoId) ?? 0) + -f.monto);
  }
  return Array.from(porBanco, ([bancoId, total]) => ({ bancoId, total })).sort(
    (a, b) => b.total - a.total || (a.bancoId < b.bancoId ? -1 : a.bancoId > b.bancoId ? 1 : 0)
  );
}

export function calcularEgresosPorDia(
  filas: FilaMovimiento[],
  desde: string,
  hasta: string
): EgresoDia[] {
  const porDia = new Map<string, number>();
  for (const f of filas) {
    if (!esComputable(f) || f.monto >= 0) continue;
    const dia = storedDayKey(f.fecha);
    if (dia < desde || dia > hasta) continue;
    porDia.set(dia, (porDia.get(dia) ?? 0) + -f.monto);
  }
  return Array.from(porDia, ([fecha, total]) => ({ fecha, total })).sort((a, b) =>
    a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0
  );
}

export function calcularNetoDia(filas: FilaMovimiento[], dia: string): number {
  let neto = 0;
  for (const f of filas) {
    if (!esComputable(f) || storedDayKey(f.fecha) !== dia) continue;
    neto += f.monto;
  }
  return neto;
}

export function construirSerie7Dias(
  egresos: EgresoDia[],
  ref: Date,
  etiquetas: readonly string[]
): BarraDia[] {
  const porDia = new Map<string, number>();
  for (const e of egresos) porDia.set(e.fecha, (porDia.get(e.fecha) ?? 0) + e.total);
  const hoyKey = localDateKey(ref);
  return localLastDaysKeys(ref, 7).map((key) => {
    const [a, m, d] = key.split('-').map(Number);
    return {
      key,
      dia: etiquetas[new Date(a, m - 1, d).getDay()],
      total: porDia.get(key) ?? 0,
      esHoy: key === hoyKey,
    };
  });
}
