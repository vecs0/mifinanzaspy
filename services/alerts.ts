/**
 * alerts
 * Responsabilidad: Genera alertas inteligentes de gastos y presupuestos sin filas archivadas
 * Usado por: components/AlertsList
 * Depende de: database, categories, totales, dateKeys
 */
import { getDB } from '@/services/database';
import { CATEGORIA_POR_ID } from '@/constants/categories';
import { gastosPorCategoriaMes } from '@/services/totales';
import { localMonthKey } from '@/services/dateKeys';
import type { FilaAgregable } from '@/services/totales';

export interface AlertaInteligente {
  tipo: 'gasto_creciente' | 'presupuesto_cerca' | 'presupuesto_excedido' | 'saldo_bajo';
  mensaje: string;
  severidad: 'baja' | 'media' | 'alta';
  categoriaId?: string;
}

export function generarAlertas(): AlertaInteligente[] {
  const alertas: AlertaInteligente[] = [];
  const ahora = new Date();
  const mesActual = localMonthKey(ahora);
  const mesAnterior = localMonthKey(new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1));

  const db = getDB();

  const gastos = db.getAllSync<FilaAgregable>(
    `SELECT monto AS monto, fecha AS fecha, archivado AS archivado,
            categoria_id AS categoriaId, banco_id AS bancoId
     FROM transacciones
     WHERE monto < 0 AND substr(fecha,1,7) IN (?, ?)`,
    [mesActual, mesAnterior]
  );

  const actual: Record<string, number> = {};
  const anterior: Record<string, number> = {};
  for (const g of gastosPorCategoriaMes(gastos)) {
    if (g.mes === mesActual) actual[g.categoriaId] = g.total;
    else anterior[g.categoriaId] = g.total;
  }

  for (const [catId, gastoAct] of Object.entries(actual)) {
    const gastoAnt = anterior[catId] ?? 0;
    if (gastoAnt > 0 && gastoAct > gastoAnt * 1.3) {
      const cat = CATEGORIA_POR_ID[catId];
      const nombre = cat?.nombre ?? 'Categoría';
      const pctSub = Math.round((gastoAct / gastoAnt - 1) * 100);
      alertas.push({
        tipo: 'gasto_creciente',
        mensaje: `${nombre} subió un ${pctSub}% este mes (Gs ${Math.round(gastoAct).toLocaleString('es-PY')} vs Gs ${Math.round(gastoAnt).toLocaleString('es-PY')} el anterior)`,
        severidad: 'alta',
        categoriaId: catId,
      });
    }
  }

  const presupRows = db.getAllSync<{ categoria_id: string; monto_limite: number }>(
    'SELECT * FROM presupuestos WHERE mes = ?',
    [mesActual]
  );

  for (const p of presupRows) {
    const gastado = actual[p.categoria_id] ?? 0;
    const pct = p.monto_limite > 0 ? Math.round((gastado / p.monto_limite) * 100) : 0;
    const cat = CATEGORIA_POR_ID[p.categoria_id];
    const nombre = cat?.nombre ?? 'Categoría';
    if (pct >= 100) {
      alertas.push({
        tipo: 'presupuesto_excedido',
        mensaje: `${nombre}: presupuesto excedido (${pct}% — Gs ${Math.round(gastado).toLocaleString('es-PY')} de Gs ${Math.round(p.monto_limite).toLocaleString('es-PY')})`,
        severidad: 'alta',
        categoriaId: p.categoria_id,
      });
    } else if (pct >= 80) {
      alertas.push({
        tipo: 'presupuesto_cerca',
        mensaje: `${nombre} al ${pct}% del presupuesto — quedan Gs ${Math.round(p.monto_limite - gastado).toLocaleString('es-PY')}`,
        severidad: 'media',
        categoriaId: p.categoria_id,
      });
    }
  }

  const saldoRow = db.getFirstSync<{ total: number }>(
    'SELECT SUM(saldo_actual) AS total FROM cuentas WHERE activa = 1'
  );
  if (saldoRow && (saldoRow.total ?? 0) < 100_000) {
    alertas.push({
      tipo: 'saldo_bajo',
      mensaje: `Saldo total bajo: Gs ${Math.round(saldoRow.total ?? 0).toLocaleString('es-PY')} en todas tus cuentas`,
      severidad: 'alta',
    });
  }

  return alertas;
}
