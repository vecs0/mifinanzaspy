/**
 * totales
 * Responsabilidad: Funciones puras de agregacion de movimientos (resumen del mes sin traspasos)
 * Usado por: __tests__/totales.test.ts
 * Depende de: services/dateKeys.ts
 */
import { localDateKey, localLastDaysKeys, storedDayKey } from './dateKeys';

export type FilaMovimiento = {
  monto: number;
  fecha: string;
  esTraspaso: number | null;
  bancoId: string | null;
  categoriaId: string | null;
  categoriaNombre: string | null;
};

export type ResumenMes = {
  ingresos: number;
  egresos: number;
  topCategorias: { id: string; nombre: string; total: number }[];
};

export type GastoBanco = { bancoId: string; total: number };

export type EgresoDia = { fecha: string; total: number };

export type BarraDia = { key: string; dia: string; total: number; esHoy: boolean };

export function esComputable(fila: Pick<FilaMovimiento, 'esTraspaso'>): boolean {
  return fila.esTraspaso !== 1;
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
