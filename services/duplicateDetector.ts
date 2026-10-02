/**
 * duplicateDetector
 * Responsabilidad: Detecta transacciones duplicadas por monto/fecha/descripción
 * Usado por: duplicados
 * Depende de: database
 */
import { getDB } from '@/services/database';
import type { Transaccion } from '@/types/finance';

export interface Duplicado {
  original: Transaccion;
  posible: Transaccion;
  score: number;
}

export function detectarDuplicados(): Duplicado[] {
  const db = getDB();
  const rows = db.getAllSync<Record<string, unknown>>(
    `SELECT * FROM transacciones ORDER BY fecha DESC`
  );
  const txs: Transaccion[] = rows.map(r => ({
    id: r['id'] as string,
    cuentaId: r['cuenta_id'] as string,
    bancoId: r['banco_id'] as string,
    monto: r['monto'] as number,
    tipo: r['tipo'] as any,
    categoriaId: r['categoria_id'] as string,
    descripcion: r['descripcion'] as string,
    fuente: r['fuente'] as any,
    fecha: r['fecha'] as string,
    saldoPost: r['saldo_post'] as number | null,
    smsRaw: r['sms_raw'] as string | null,
    procesado: (r['procesado'] as number) === 1,
    notas: r['notas'] as string | null,
    adjunto: r['adjunto'] as string | null,
  }));

  const duplicados: Duplicado[] = [];
  for (let i = 0; i < txs.length; i++) {
    for (let j = i + 1; j < txs.length; j++) {
      const a = txs[i];
      const b = txs[j];
      if (a.id === b.id) continue;

      let score = 0;
      if (Math.abs(a.monto) === Math.abs(b.monto)) score += 30;
      if (a.bancoId === b.bancoId) score += 15;
      if (a.cuentaId === b.cuentaId) score += 10;
      const diffMs = Math.abs(new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
      if (diffMs < 86400000) score += 25;
      else if (diffMs < 604800000) score += 10;

      if (score >= 50) {
        duplicados.push({ original: a, posible: b, score });
      }
    }
  }
  return duplicados.sort((a, b) => b.score - a.score);
}
