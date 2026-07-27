/**
 * metas
 * Responsabilidad: CRUD de metas de ahorro
 * Usado por: _layout, crecer, meta/nueva
 * Depende de: database
 */
import { getDB } from '@/services/database';

export type TipoMeta = 'solo' | 'grupo' | 'fijo' | 'largo';

export interface Meta {
  id: string;
  titulo: string;
  icono: string;
  tipo: TipoMeta;
  metaMonto: number;
  actualMonto: number;
  diasRestantes: number;
  esGrupo: boolean;
  miembros: string[];    // iniciales de los miembros del grupo
  notifCount: number;
  fechaCreacion: string;
  fechaMeta?: string;    // ISO date target
}

function ensureTable(): void {
  try {
    getDB().execSync(`
      CREATE TABLE IF NOT EXISTS metas (
        id            TEXT PRIMARY KEY,
        titulo        TEXT NOT NULL,
        icono         TEXT NOT NULL DEFAULT 'sparkles',
        tipo          TEXT NOT NULL DEFAULT 'solo',
        meta_monto    INTEGER NOT NULL DEFAULT 0,
        actual_monto  INTEGER NOT NULL DEFAULT 0,
        dias_restantes INTEGER NOT NULL DEFAULT 30,
        es_grupo      INTEGER NOT NULL DEFAULT 0,
        miembros      TEXT NOT NULL DEFAULT '[]',
        notif_count   INTEGER NOT NULL DEFAULT 0,
        fecha_creacion TEXT NOT NULL DEFAULT (datetime('now')),
        fecha_meta    TEXT
      )
    `);
  } catch (_) { console.warn('[Metas] Error'); }
}

function rowToMeta(r: Record<string, unknown>): Meta {
  return {
    id:             r['id'] as string,
    titulo:         r['titulo'] as string,
    icono:          r['icono'] as string,
    tipo:           (r['tipo'] as TipoMeta) ?? 'solo',
    metaMonto:      r['meta_monto'] as number,
    actualMonto:    r['actual_monto'] as number,
    diasRestantes:  r['dias_restantes'] as number,
    esGrupo:        (r['es_grupo'] as number) === 1,
    miembros:       JSON.parse((r['miembros'] as string) ?? '[]'),
    notifCount:     r['notif_count'] as number,
    fechaCreacion:  r['fecha_creacion'] as string,
    fechaMeta:      r['fecha_meta'] as string | undefined,
  };
}

export function getMetas(): Meta[] {
  ensureTable();
  const rows = getDB().getAllSync<Record<string, unknown>>(
    'SELECT * FROM metas ORDER BY fecha_creacion DESC'
  );
  return rows.map(rowToMeta);
}

export function getMeta(id: string): Meta | null {
  ensureTable();
  const row = getDB().getFirstSync<Record<string, unknown>>(
    'SELECT * FROM metas WHERE id = ?', [id]
  );
  return row ? rowToMeta(row) : null;
}

export function insertMeta(data: Omit<Meta, 'id' | 'fechaCreacion'>): Meta {
  ensureTable();
  const id = `meta_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const fechaCreacion = new Date().toISOString();
  getDB().runSync(
    `INSERT INTO metas (id, titulo, icono, tipo, meta_monto, actual_monto, dias_restantes,
      es_grupo, miembros, notif_count, fecha_creacion, fecha_meta)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, data.titulo, data.icono, data.tipo,
      data.metaMonto, data.actualMonto, data.diasRestantes,
      data.esGrupo ? 1 : 0, JSON.stringify(data.miembros),
      data.notifCount, fechaCreacion, data.fechaMeta ?? null,
    ]
  );
  return { ...data, id, fechaCreacion };
}

export function updateMetaAhorro(id: string, nuevoActual: number): void {
  ensureTable();
  getDB().runSync(
    'UPDATE metas SET actual_monto = ? WHERE id = ?',
    [nuevoActual, id]
  );
}

export function updateMeta(id: string, data: Partial<Omit<Meta, 'id' | 'fechaCreacion'>>): void {
  ensureTable();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.titulo      !== undefined) { fields.push('titulo = ?');          values.push(data.titulo); }
  if (data.icono       !== undefined) { fields.push('icono = ?');           values.push(data.icono); }
  if (data.tipo        !== undefined) { fields.push('tipo = ?');            values.push(data.tipo); }
  if (data.metaMonto   !== undefined) { fields.push('meta_monto = ?');      values.push(data.metaMonto); }
  if (data.actualMonto !== undefined) { fields.push('actual_monto = ?');    values.push(data.actualMonto); }
  if (data.diasRestantes !== undefined) { fields.push('dias_restantes = ?'); values.push(data.diasRestantes); }
  if (data.esGrupo     !== undefined) { fields.push('es_grupo = ?');        values.push(data.esGrupo ? 1 : 0); }
  if (data.miembros    !== undefined) { fields.push('miembros = ?');        values.push(JSON.stringify(data.miembros)); }
  if (data.notifCount  !== undefined) { fields.push('notif_count = ?');     values.push(data.notifCount); }
  if (data.fechaMeta   !== undefined) { fields.push('fecha_meta = ?');      values.push(data.fechaMeta); }

  if (fields.length === 0) return;
  values.push(id);
  getDB().runSync(`UPDATE metas SET ${fields.join(', ')} WHERE id = ?`, values as string[]);
}

export function deleteMeta(id: string): void {
  getDB().runSync('DELETE FROM metas WHERE id = ?', [id]);
}

/** Sumar ahorro a una meta específica */
export function agregarAhorroAMeta(id: string, monto: number): void {
  ensureTable();
  getDB().runSync(
    'UPDATE metas SET actual_monto = actual_monto + ? WHERE id = ?',
    [monto, id]
  );
}

/** Total ahorrado en todas las metas activas */
export function getTotalAhorradoEnMetas(): number {
  ensureTable();
  const row = getDB().getFirstSync<{ total: number }>(
    'SELECT COALESCE(SUM(actual_monto), 0) AS total FROM metas'
  );
  return row?.total ?? 0;
}

/** Eliminar metas demo (títulos conocidos) */
export function clearDemoMetas(): void {
  ensureTable();
  const demoTitulos = [
    'Notebook MacBook',
    'Viaje a Encarnación',
    'Fondo de urgencia',
    'Cuotas tarjeta Itaú',
  ];
  for (const titulo of demoTitulos) {
    try {
      getDB().runSync('DELETE FROM metas WHERE titulo = ?', [titulo]);
    } catch (_) { console.warn('[Metas] Error'); }
  }
}
