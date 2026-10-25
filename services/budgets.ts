/**
 * budgets
 * Responsabilidad: CRUD de presupuestos por categoría y gasto del mes sin filas archivadas
 * Usado por: presupuestos, crecer
 * Depende de: database, totales
 */
import { getDB } from '@/services/database';
import { gastosPorCategoriaMes } from '@/services/totales';
import type { FilaAgregable } from '@/services/totales';

export interface Presupuesto {
  id: string;
  categoriaId: string;
  montoLimite: number;
  mes: string;
}

export interface PresupuestoConGasto extends Presupuesto {
  gastado: number;
  pct: number;
}

function ensureTable(): void {
  const db = getDB();
  try {
    db.execSync(
      'CREATE TABLE IF NOT EXISTS presupuestos (id TEXT PRIMARY KEY, categoria_id TEXT NOT NULL REFERENCES categorias(id), monto_limite INTEGER NOT NULL, mes TEXT NOT NULL, UNIQUE(categoria_id, mes))'
    );
  } catch (_) { console.warn('[Budgets] Error'); }
}

export function getPresupuestos(mes: string): Presupuesto[] {
  ensureTable();
  const rows = getDB().getAllSync<Record<string, unknown>>(
    'SELECT * FROM presupuestos WHERE mes = ? ORDER BY categoria_id',
    [mes]
  );
  return rows.map(r => ({
    id: r['id'] as string,
    categoriaId: r['categoria_id'] as string,
    montoLimite: r['monto_limite'] as number,
    mes: r['mes'] as string,
  }));
}

export function getPresupuestosConGasto(mes: string): PresupuestoConGasto[] {
  const presupuestos = getPresupuestos(mes);
  if (presupuestos.length === 0) return [];

  const db = getDB();
  const filas = db.getAllSync<FilaAgregable>(
    `SELECT monto AS monto, fecha AS fecha, archivado AS archivado,
            categoria_id AS categoriaId, banco_id AS bancoId
     FROM transacciones
     WHERE monto < 0 AND substr(fecha, 1, 7) = ?`,
    [mes]
  );
  const gastoMap: Record<string, number> = {};
  for (const g of gastosPorCategoriaMes(filas)) {
    if (g.mes === mes) gastoMap[g.categoriaId] = g.total;
  }

  return presupuestos.map(p => ({
    ...p,
    gastado: gastoMap[p.categoriaId] ?? 0,
    pct: p.montoLimite > 0 ? Math.min(100, Math.round(((gastoMap[p.categoriaId] ?? 0) / p.montoLimite) * 100)) : 0,
  }));
}

export function setPresupuesto(categoriaId: string, montoLimite: number, mes: string): void {
  ensureTable();
  const id = `${categoriaId}_${mes}`;
  getDB().runSync(
    'INSERT OR REPLACE INTO presupuestos (id, categoria_id, monto_limite, mes) VALUES (?, ?, ?, ?)',
    [id, categoriaId, montoLimite, mes]
  );
}

export function deletePresupuesto(categoriaId: string, mes: string): void {
  getDB().runSync(
    'DELETE FROM presupuestos WHERE categoria_id = ? AND mes = ?',
    [categoriaId, mes]
  );
}
