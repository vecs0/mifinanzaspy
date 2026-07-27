/**
 * alerts
 * Responsabilidad: Genera alertas inteligentes de gastos y presupuestos
 * Usado por: components/AlertsList
 * Depende de: database, categories
 */
import { getDB } from '@/services/database';
import { CATEGORIA_POR_ID } from '@/constants/categories';

export interface AlertaInteligente {
  tipo: 'gasto_creciente' | 'presupuesto_cerca' | 'presupuesto_excedido' | 'saldo_bajo';
  mensaje: string;
  severidad: 'baja' | 'media' | 'alta';
  categoriaId?: string;
}

export function generarAlertas(): AlertaInteligente[] {
  const alertas: AlertaInteligente[] = [];
  const ahora = new Date();
  const mesActual = ahora.toISOString().slice(0, 7);
  const anio = ahora.getFullYear();
  const mesNum = ahora.getMonth() + 1;
  const mesAnterior = mesNum === 1
    ? `${anio - 1}-12`
    : `${anio}-${String(mesNum - 1).padStart(2, '0')}`;

  const db = getDB();

  const gastos = db.getAllSync<{ categoria_id: string; total: number; mes: string }>(
    `SELECT categoria_id, SUM(ABS(monto)) AS total, substr(fecha,1,7) AS mes
     FROM transacciones WHERE monto < 0 AND substr(fecha,1,7) IN (?, ?)
     GROUP BY categoria_id, mes`,
    [mesActual, mesAnterior]
  );

  const actual: Record<string, number> = {};
  const anterior: Record<string, number> = {};
  for (const g of gastos) {
    if (g.mes === mesActual) actual[g.categoria_id] = g.total;
    else anterior[g.categoria_id] = g.total;
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
