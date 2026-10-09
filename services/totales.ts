/**
 * totales
 * Responsabilidad: Funciones puras de agregacion de movimientos (resumen del mes sin traspasos)
 * Usado por: __tests__/totales.test.ts
 * Depende de: services/dateKeys.ts
 */
import { storedDayKey } from './dateKeys';

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
  _limiteTop: number
): ResumenMes {
  let ingresos = 0;
  let egresos = 0;
  for (const f of filas) {
    if (!esComputable(f) || storedDayKey(f.fecha).slice(0, 7) !== mes) continue;
    if (f.monto > 0) ingresos += f.monto;
    else if (f.monto < 0) egresos += -f.monto;
  }
  return { ingresos, egresos, topCategorias: [] };
}
