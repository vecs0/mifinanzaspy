/**
 * database
 * Responsabilidad: Capa de acceso a SQLite (sync API) con Expo SQLite
 * Usado por: toda la app (~29 imports)
 * Depende de: encryption, categories, dateKeys, totales, archivo
 * Migraciones: cuentas duplicadas, orden col, adjunto, traspasos, categorias_ocultas, chat_cache session_id, archivo (archivado, archivado_en, archivado_motivo)
 */
import * as SQLite from 'expo-sqlite';
import { CATEGORIAS } from '@/constants/categories';
import nacl from 'tweetnacl';
import { encrypt, decrypt, encriptarCampo, desencriptarCampo } from '@/services/encryption';
import { localDateKey, localMonthKey, localLastDaysKeys, localDateTimeKey, storedDayKey } from '@/services/dateKeys';
import { agruparOperaciones, ajustesPorCuenta, normalizarArchivado, ordenarArchivo, resolverOperacion } from '@/services/archivo';
import type { AjusteCuenta, FilaArchivo, OperacionArchivo } from '@/services/archivo';
import {
  calcularResumenMes, calcularGastosPorBanco, calcularEgresosPorDia, calcularNetoDia,
} from '@/services/totales';
import type { FilaMovimiento, ResumenMes, GastoBanco, EgresoDia } from '@/services/totales';
import type {
  CuentaBancaria, Transaccion, Categoria,
  ReglaClasificacion, EstadoOnboarding,
  NotificacionApp,
} from '@/types/finance';

let db: SQLite.SQLiteDatabase | null = null;
let migrationsRun = false;

function getDB(): SQLite.SQLiteDatabase {
  if (!db) {
    db = SQLite.openDatabaseSync('mifinanzaspy.db');
    initSchema(db);
  }
  if (!migrationsRun) {
    migrate(db);
    migrationsRun = true;
  }
  return db;
}

function migrate(database: SQLite.SQLiteDatabase): void {
  try {
    database.execSync('CREATE TABLE IF NOT EXISTS presupuestos (id TEXT PRIMARY KEY, categoria_id TEXT NOT NULL REFERENCES categorias(id), monto_limite INTEGER NOT NULL, mes TEXT NOT NULL, UNIQUE(categoria_id, mes))');
  } catch (_) { console.warn('[DB] Migration: presupuestos table'); }
  try {
    database.execSync('CREATE TABLE IF NOT EXISTS recordatorios (id TEXT PRIMARY KEY, titulo TEXT NOT NULL, descripcion TEXT NOT NULL DEFAULT \'\', fecha TEXT NOT NULL, repetir TEXT NOT NULL DEFAULT \'no\', activo INTEGER NOT NULL DEFAULT 1, categoria_id TEXT, monto_estimado INTEGER NOT NULL DEFAULT 0)');
  } catch (_) { console.warn('[DB] Migration: recordatorios table'); }
  try {
    database.execSync('CREATE TABLE IF NOT EXISTS notificaciones (id TEXT PRIMARY KEY, titulo TEXT NOT NULL, cuerpo TEXT NOT NULL, tipo TEXT NOT NULL DEFAULT \'info\', leida INTEGER NOT NULL DEFAULT 0, eliminada INTEGER NOT NULL DEFAULT 0, fecha_creacion TEXT NOT NULL DEFAULT (datetime(\'now\')))');
  } catch (_) { console.warn('[DB] Migration: notificaciones table'); }
  try {
    database.execSync(
      "DELETE FROM cuentas WHERE id NOT IN (SELECT MIN(id) FROM cuentas GROUP BY banco_id, alias)"
    );
  } catch (_) { console.warn('[DB] Migration: delete duplicate cuentas'); }
  try { database.execSync('ALTER TABLE cuentas ADD COLUMN orden INTEGER NOT NULL DEFAULT 0'); } catch (_) { console.warn('[DB] Migration: orden column'); }
  try { database.execSync("ALTER TABLE transacciones ADD COLUMN adjunto TEXT"); } catch (_) { console.warn('[DB] Migration: adjunto column'); }
  try { database.execSync("ALTER TABLE transacciones ADD COLUMN es_traspaso INTEGER NOT NULL DEFAULT 0"); } catch (_) { console.warn('[DB] Migration: es_traspaso column'); }
  try { database.execSync("ALTER TABLE transacciones ADD COLUMN cuenta_par_id TEXT REFERENCES cuentas(id)"); } catch (_) { console.warn('[DB] Migration: cuenta_par_id column'); }
  try { database.execSync("ALTER TABLE transacciones ADD COLUMN contraparte_banco_id TEXT"); } catch (_) { console.warn('[DB] Migration: contraparte_banco_id column'); }
  try { database.execSync("ALTER TABLE transacciones ADD COLUMN contraparte_nombre TEXT"); } catch (_) { console.warn('[DB] Migration: contraparte_nombre column'); }
  try { database.execSync("CREATE INDEX IF NOT EXISTS idx_tx_traspaso ON transacciones(es_traspaso, fecha) WHERE es_traspaso = 1"); } catch (_) { console.warn('[DB] Migration: idx_traspaso index'); }
  try { database.execSync("CREATE INDEX IF NOT EXISTS idx_tx_cuenta_par ON transacciones(cuenta_par_id) WHERE cuenta_par_id IS NOT NULL"); } catch (_) { console.warn('[DB] Migration: idx_cuenta_par index'); }
  try { database.execSync("ALTER TABLE transacciones ADD COLUMN hash_verificacion TEXT"); } catch (_) { console.warn('[DB] Migration: hash_verificacion column'); }
  try { database.execSync("CREATE INDEX IF NOT EXISTS idx_tx_hash ON transacciones(hash_verificacion) WHERE hash_verificacion IS NOT NULL"); } catch (_) { console.warn('[DB] Migration: idx_hash index'); }
  try { database.execSync("ALTER TABLE transacciones ADD COLUMN archivado INTEGER NOT NULL DEFAULT 0"); } catch (_) { console.warn('[DB] Migration: archivado column'); }
  try { database.execSync("ALTER TABLE transacciones ADD COLUMN archivado_en TEXT"); } catch (_) { console.warn('[DB] Migration: archivado_en column'); }
  try { database.execSync("ALTER TABLE transacciones ADD COLUMN archivado_motivo TEXT"); } catch (_) { console.warn('[DB] Migration: archivado_motivo column'); }
  try { database.execSync("CREATE INDEX IF NOT EXISTS idx_tx_archivado ON transacciones(archivado, fecha DESC) WHERE archivado = 1"); } catch (_) { console.warn('[DB] Migration: idx_archivado index'); }
  try { database.execSync('CREATE TABLE IF NOT EXISTS categorias_ocultas (id TEXT PRIMARY KEY)'); } catch (_) { console.warn('[DB] Migration: categorias_ocultas table'); }
  try { database.execSync('ALTER TABLE chat_cache ADD COLUMN session_id TEXT'); } catch (_) { console.warn('[DB] Migration: chat_cache session_id column'); }
}

function initSchema(database: SQLite.SQLiteDatabase): void {
  try { database.execSync('PRAGMA journal_mode=WAL'); } catch (_) { console.warn('[DB] Migration: PRAGMA journal_mode'); }
  try { database.execSync('PRAGMA foreign_keys=ON'); } catch (_) { console.warn('[DB] Migration: PRAGMA foreign_keys'); }
  database.execSync(
    'CREATE TABLE IF NOT EXISTS cuentas (id TEXT PRIMARY KEY, banco_id TEXT NOT NULL, banco_nombre TEXT NOT NULL, app_package TEXT NOT NULL DEFAULT \'\', tipo_cuenta TEXT NOT NULL DEFAULT \'corriente\', alias TEXT NOT NULL, saldo_actual INTEGER NOT NULL DEFAULT 0, moneda TEXT NOT NULL DEFAULT \'PYG\', activa INTEGER NOT NULL DEFAULT 1, sms_habilitado INTEGER NOT NULL DEFAULT 1, notif_habilitada INTEGER NOT NULL DEFAULT 1, color TEXT NOT NULL DEFAULT \'#B36A2A\', icono TEXT NOT NULL DEFAULT \'bank\', fecha_creacion TEXT NOT NULL);' +
    'CREATE TABLE IF NOT EXISTS transacciones (id TEXT PRIMARY KEY, cuenta_id TEXT NOT NULL REFERENCES cuentas(id) ON DELETE CASCADE, banco_id TEXT NOT NULL, monto INTEGER NOT NULL, tipo TEXT NOT NULL, categoria_id TEXT NOT NULL DEFAULT \'otros\', descripcion TEXT NOT NULL DEFAULT \'\', fuente TEXT NOT NULL DEFAULT \'manual\', fecha TEXT NOT NULL, saldo_post INTEGER, sms_raw TEXT, procesado INTEGER NOT NULL DEFAULT 0, notas TEXT, created_at TEXT NOT NULL DEFAULT (datetime(\'now\')));' +
    'CREATE INDEX IF NOT EXISTS idx_tx_cuenta ON transacciones(cuenta_id);' +
    'CREATE INDEX IF NOT EXISTS idx_tx_fecha ON transacciones(fecha DESC);' +
    'CREATE INDEX IF NOT EXISTS idx_tx_banco ON transacciones(banco_id);' +
    'CREATE INDEX IF NOT EXISTS idx_tx_cat ON transacciones(categoria_id);' +
    'CREATE TABLE IF NOT EXISTS categorias (id TEXT PRIMARY KEY, nombre TEXT NOT NULL, icono TEXT NOT NULL DEFAULT \'dots\', tinte TEXT NOT NULL DEFAULT \'#6B7280\', tipo TEXT NOT NULL DEFAULT \'mixto\');' +
    'CREATE TABLE IF NOT EXISTS reglas_clasificacion (id TEXT PRIMARY KEY, patron_texto TEXT NOT NULL, categoria_id TEXT NOT NULL REFERENCES categorias(id), prioridad INTEGER NOT NULL DEFAULT 0, es_regex INTEGER NOT NULL DEFAULT 0);' +
    'CREATE TABLE IF NOT EXISTS reportes_cache (id TEXT PRIMARY KEY, tipo TEXT NOT NULL, fecha TEXT NOT NULL, contenido_json TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime(\'now\')), UNIQUE(tipo, fecha));' +
    'CREATE TABLE IF NOT EXISTS configuracion (clave TEXT PRIMARY KEY, valor TEXT NOT NULL);' +
    'CREATE TABLE IF NOT EXISTS chat_cache (id TEXT PRIMARY KEY, rol TEXT NOT NULL, texto TEXT NOT NULL, fecha TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime(\'now\')))'
  );
  const count = database.getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM categorias');
  if (count && count.n === 0) {
    for (const cat of CATEGORIAS) {
      try {
        database.runSync(
          'INSERT OR IGNORE INTO categorias (id, nombre, icono, tinte, tipo) VALUES (?, ?, ?, ?, ?)',
          [cat.id, cat.nombre, cat.icono, cat.tinte, cat.tipo]
        );
      } catch (_) { console.warn('[DB] Migration: insert categories'); }
    }
  }
}

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function now(): string {
  return new Date().toISOString();
}

function mapCuenta(r: Record<string, unknown>): CuentaBancaria {
  return {
    id:               r['id'] as string,
    bancoId:          r['banco_id'] as string,
    bancoNombre:      r['banco_nombre'] as string,
    appPackage:       r['app_package'] as string,
    tipoCuenta:       r['tipo_cuenta'] as CuentaBancaria['tipoCuenta'],
    alias:            r['alias'] as string,
    saldoActual:      r['saldo_actual'] as number,
    moneda:           r['moneda'] as CuentaBancaria['moneda'],
    activa:           (r['activa'] as number) === 1,
    smsHabilitado:    (r['sms_habilitado'] as number) === 1,
    notifHabilitada:  (r['notif_habilitada'] as number) === 1,
    color:            r['color'] as string,
    icono:            r['icono'] as string,
    orden:            (r['orden'] as number) ?? 0,
    fechaCreacion:    r['fecha_creacion'] as string,
  };
}

function mapTransaccion(r: Record<string, unknown>): Transaccion {
  return {
    id:          r['id'] as string,
    cuentaId:    r['cuenta_id'] as string,
    bancoId:     r['banco_id'] as string,
    monto:       r['monto'] as number,
    tipo:        r['tipo'] as Transaccion['tipo'],
    categoriaId: r['categoria_id'] as string,
    descripcion: r['descripcion'] as string,
    fuente:      r['fuente'] as Transaccion['fuente'],
    fecha:       r['fecha'] as string,
    saldoPost:   r['saldo_post'] as number | null,
    smsRaw:      r['sms_raw'] as string | null,
    procesado:   (r['procesado'] as number) === 1,
    notas:       r['notas'] as string | null,
    adjunto:            r['adjunto'] as string | null,
    esTraspaso:         (r['es_traspaso'] as number) ?? 0,
    cuentaParId:        r['cuenta_par_id'] as string | null,
    contraparteBancoId: r['contraparte_banco_id'] as string | null,
    contraparteNombre:  r['contraparte_nombre'] as string | null,
    archivado:          normalizarArchivado(r['archivado']),
    archivadoEn:        r['archivado_en'] as string | null,
    archivadoMotivo:    r['archivado_motivo'] as string | null,
  };
}

export type TransaccionArchivada = Omit<
  Transaccion,
  'esTraspaso' | 'cuentaParId' | 'archivado' | 'archivadoEn' | 'archivadoMotivo'
> & {
  esTraspaso: number;
  cuentaParId: string | null;
  archivado: number;
  archivadoEn: string | null;
  archivadoMotivo: string | null;
  cuentaAlias: string;
  cuentaActiva: boolean;
};

function ordenarArchivadas<T extends FilaArchivo>(filas: T[]): T[] {
  const posicion = new Map(ordenarArchivo(filas).map((fila, indice) => [fila.id, indice]));
  return [...filas].sort((a, b) => (posicion.get(a.id) ?? 0) - (posicion.get(b.id) ?? 0));
}

export function getCuentas(): CuentaBancaria[] {
  const db = getDB();
  const rows = db.getAllSync<Record<string, unknown>>(
    'SELECT * FROM cuentas WHERE activa = 1 ORDER BY orden ASC, fecha_creacion ASC'
  );
  return rows.map(mapCuenta);
}

export function insertCuenta(cuenta: Omit<CuentaBancaria, 'id' | 'fechaCreacion' | 'orden'> & { orden?: number }): CuentaBancaria {
  const db = getDB();
  const id = uuid();
  const fecha = now();
  const maxOrden = (db.getFirstSync<{ m: number }>('SELECT COALESCE(MAX(orden), -1) + 1 AS m FROM cuentas'))?.m ?? 0;
  const orden = cuenta.orden ?? maxOrden;
  db.runSync(
    `INSERT INTO cuentas
      (id, banco_id, banco_nombre, app_package, tipo_cuenta, alias,
       saldo_actual, moneda, activa, sms_habilitado, notif_habilitada,
       color, icono, orden, fecha_creacion)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, cuenta.bancoId, cuenta.bancoNombre, cuenta.appPackage,
      cuenta.tipoCuenta, cuenta.alias, cuenta.saldoActual, cuenta.moneda,
      cuenta.activa ? 1 : 0, cuenta.smsHabilitado ? 1 : 0,
      cuenta.notifHabilitada ? 1 : 0, cuenta.color, cuenta.icono, orden, fecha,
    ]
  );
  return { ...cuenta, orden, id, fechaCreacion: fecha };
}

export function updateSaldoCuenta(cuentaId: string, saldo: number): void {
  getDB().runSync('UPDATE cuentas SET saldo_actual = ? WHERE id = ?', [saldo, cuentaId]);
}

export function updateCuentaToggle(cuentaId: string, campo: 'sms_habilitado' | 'notif_habilitada', valor: boolean): void {
  getDB().runSync(`UPDATE cuentas SET ${campo} = ? WHERE id = ?`, [valor ? 1 : 0, cuentaId]);
}

export function deleteCuenta(cuentaId: string): void {
  getDB().runSync('UPDATE cuentas SET activa = 0 WHERE id = ?', [cuentaId]);
}

export function actualizarOrdenCuenta(cuentaId: string, nuevoOrden: number): void {
  getDB().runSync('UPDATE cuentas SET orden = ? WHERE id = ?', [nuevoOrden, cuentaId]);
}

export async function getTransacciones(opciones: {
  cuentaId?: string; bancoId?: string; categoriaId?: string;
  desde?: string; hasta?: string; limite?: number; offset?: number;
} = {}): Promise<Transaccion[]> {
  const db = getDB();
  const condiciones: string[] = ['archivado = 0'];
  const params: (string | number)[] = [];

  if (opciones.cuentaId)    { condiciones.push('cuenta_id = ?');    params.push(opciones.cuentaId); }
  if (opciones.bancoId)     { condiciones.push('banco_id = ?');     params.push(opciones.bancoId); }
  if (opciones.categoriaId) { condiciones.push('categoria_id = ?'); params.push(opciones.categoriaId); }
  if (opciones.desde)       { condiciones.push('fecha >= ?');       params.push(opciones.desde); }
  if (opciones.hasta)       { condiciones.push('fecha <= ?');       params.push(opciones.hasta); }

  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  const limit = opciones.limite ?? 100;
  const offset = opciones.offset ?? 0;

  const rows = db.getAllSync<Record<string, unknown>>(
    `SELECT * FROM transacciones ${where} ORDER BY fecha DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const descifradas = await Promise.all(rows.map(async r => {
    const t = mapTransaccion(r);
    t.smsRaw = await descifrarSeguro(t.smsRaw);
    t.descripcion = (await descifrarSeguro(t.descripcion)) ?? '';
    return t;
  }));
  return descifradas;
}

async function descifrarSeguro(valor: string | null): Promise<string | null> {
  try {
    return await decrypt(valor);
  } catch (e) {
    console.warn('[DB] No se pudo descifrar un campo:', e);
    return '';
  }
}

export async function getTransaccionPorId(id: string): Promise<Transaccion | null> {
  const row = getDB().getFirstSync<Record<string, unknown>>(
    'SELECT * FROM transacciones WHERE id = ?',
    [id]
  );
  if (!row) return null;
  const t = mapTransaccion(row);
  t.smsRaw = await descifrarSeguro(t.smsRaw);
  t.descripcion = (await descifrarSeguro(t.descripcion)) ?? '';
  return t;
}

export async function getTransaccionesArchivadas(
  filtros: { cuentaId?: string; bancoId?: string } = {}
): Promise<TransaccionArchivada[]> {
  const db = getDB();
  const condiciones: string[] = ['archivado = 1'];
  const params: (string | number)[] = [];
  if (filtros.cuentaId) { condiciones.push('cuenta_id = ?'); params.push(filtros.cuentaId); }
  if (filtros.bancoId)  { condiciones.push('banco_id = ?');  params.push(filtros.bancoId); }

  const rows = db.getAllSync<Record<string, unknown>>(
    `SELECT * FROM transacciones WHERE ${condiciones.join(' AND ')}`,
    params
  );
  const cuentas = db.getAllSync<Record<string, unknown>>('SELECT * FROM cuentas');
  const archivadas = await Promise.all(rows.map(async r => {
    const t = mapTransaccion(r);
    t.smsRaw = await descifrarSeguro(t.smsRaw);
    t.descripcion = (await descifrarSeguro(t.descripcion)) ?? '';
    const cuenta = cuentas.find(c => c['id'] === t.cuentaId);
    return {
      ...t,
      esTraspaso: t.esTraspaso ?? 0,
      cuentaParId: t.cuentaParId ?? null,
      archivado: normalizarArchivado(r['archivado']),
      archivadoEn: (r['archivado_en'] as string | null) ?? null,
      archivadoMotivo: (r['archivado_motivo'] as string | null) ?? null,
      cuentaAlias: cuenta ? (cuenta['alias'] as string) : t.cuentaId,
      cuentaActiva: cuenta ? (cuenta['activa'] as number) === 1 : false,
    };
  }));
  return ordenarArchivadas(archivadas);
}

const FUENTES_AUTOMATICAS = new Set(['sms', 'notificacion', 'csv', 'email', 'pdf', 'foto']);

export function calcularHashTransaccion(tx: Pick<Transaccion, 'cuentaId' | 'monto' | 'fecha' | 'descripcion' | 'smsRaw'>): string {
  const base = [tx.cuentaId, tx.monto, tx.fecha.slice(0, 10), (tx.smsRaw || tx.descripcion || '').trim().toLowerCase()].join('|');
  const h = nacl.hash(new TextEncoder().encode(base));
  return Array.from(h.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function existeTransaccionPorHash(hash: string): boolean {
  const row = getDB().getFirstSync<{ id: string }>(
    'SELECT id FROM transacciones WHERE hash_verificacion = ? LIMIT 1',
    [hash]
  );
  return !!row;
}

const TANDA_HASHES = 400;

export function existenHashes(hashes: string[]): { hash: string; id: string; archivado: number }[] {
  const db = getDB();
  const encontrados: { hash: string; id: string; archivado: number }[] = [];
  for (let i = 0; i < hashes.length; i += TANDA_HASHES) {
    const tanda = hashes.slice(i, i + TANDA_HASHES);
    const rows = db.getAllSync<Record<string, unknown>>(
      `SELECT * FROM transacciones WHERE hash_verificacion IN (${marcadores(tanda.length)})`,
      tanda
    );
    for (const row of rows) {
      encontrados.push({
        hash: row['hash_verificacion'] as string,
        id: row['id'] as string,
        archivado: normalizarArchivado(row['archivado']),
      });
    }
  }
  return encontrados;
}

function asegurarCuentaEfectivo(db: SQLite.SQLiteDatabase): void {
  db.runSync(
    `INSERT OR IGNORE INTO cuentas (id, banco_id, banco_nombre, app_package, tipo_cuenta, alias, saldo_actual, moneda, activa, sms_habilitado, notif_habilitada, color, icono, fecha_creacion)
     VALUES ('efectivo', 'efectivo', 'Efectivo', '', 'efectivo', 'Efectivo', 0, 'PYG', 0, 0, 0, '#2D7A56', 'cash', ?)`,
    [new Date().toISOString()]
  );
}

export async function insertTransaccion(tx: Omit<Transaccion, 'id'>): Promise<Transaccion> {
  const db = getDB();
  if (tx.cuentaId === 'efectivo') asegurarCuentaEfectivo(db);

  const hash = calcularHashTransaccion(tx);
  if (FUENTES_AUTOMATICAS.has(tx.fuente)) {
    const existing = db.getFirstSync<{ id: string }>(
      'SELECT id FROM transacciones WHERE hash_verificacion = ? LIMIT 1',
      [hash]
    );
    if (existing) return { ...tx, id: existing.id };
  }

  const id = uuid();
  const smsCifrado = await encrypt(tx.smsRaw ?? null);
  const descCifrada = await encrypt(tx.descripcion || null);
  db.runSync(
    `INSERT INTO transacciones
      (id, cuenta_id, banco_id, monto, tipo, categoria_id, descripcion,
       fuente, fecha, saldo_post, sms_raw, procesado, notas, adjunto,
       es_traspaso, cuenta_par_id, contraparte_banco_id, contraparte_nombre, hash_verificacion,
       archivado, archivado_en)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, tx.cuentaId, tx.bancoId, tx.monto, tx.tipo, tx.categoriaId,
      descCifrada ?? '', tx.fuente, tx.fecha,
      tx.saldoPost ?? null, smsCifrado,
      tx.procesado ? 1 : 0, tx.notas ?? null,
      tx.adjunto ?? null,
      tx.esTraspaso ?? 0, tx.cuentaParId ?? null,
      tx.contraparteBancoId ?? null, tx.contraparteNombre ?? null,
      hash,
      0, null,
    ]
  );
  db.runSync('UPDATE cuentas SET saldo_actual = saldo_actual + ? WHERE id = ?', [tx.monto, tx.cuentaId]);
  return { ...tx, id };
}

export function updateCategoria(txId: string, categoriaId: string): void {
  getDB().runSync(
    'UPDATE transacciones SET categoria_id = ?, procesado = 1 WHERE id = ?',
    [categoriaId, txId]
  );
}

export async function updateTransaccion(txId: string, data: { descripcion?: string; monto?: number; fecha?: string }): Promise<void> {
  const db = getDB();
  const existing = db.getFirstSync<Record<string, unknown>>(
    'SELECT * FROM transacciones WHERE id = ?',
    [txId]
  );
  if (!existing) return;

  const sets: string[] = [];
  const vals: (string | number | null)[] = [];
  let diferencia = 0;
  if (data.descripcion !== undefined) {
    const descCifrada = await encrypt(data.descripcion);
    sets.push('descripcion = ?');
    vals.push(descCifrada ?? '');
  }
  if (data.monto !== undefined) {
    diferencia = data.monto - (existing['monto'] as number);
    sets.push('monto = ?');
    vals.push(data.monto);
  }
  if (data.fecha !== undefined) {
    sets.push('fecha = ?');
    vals.push(data.fecha);
  }
  if (sets.length === 0) return;
  const cambiaFlujos = data.monto !== undefined || data.fecha !== undefined;
  vals.push(txId);
  db.withTransactionSync(() => {
    if (diferencia !== 0) {
      db.runSync('UPDATE cuentas SET saldo_actual = saldo_actual + ? WHERE id = ?', [diferencia, existing['cuenta_id'] as string]);
    }
    db.runSync(`UPDATE transacciones SET ${sets.join(', ')} WHERE id = ?`, vals);
    if (cambiaFlujos) invalidarReportesCache();
  });
}

export function deleteTransaccion(txId: string, monto: number, cuentaId: string): void {
  const db = getDB();
  db.runSync('DELETE FROM transacciones WHERE id = ?', [txId]);
  db.runSync('UPDATE cuentas SET saldo_actual = saldo_actual - ? WHERE id = ?', [monto, cuentaId]);
}

function marcadores(cantidad: number): string {
  return Array.from({ length: cantidad }, () => '?').join(', ');
}

function filaArchivoDe(r: Record<string, unknown>): FilaArchivo {
  return {
    id: r['id'] as string,
    cuentaId: r['cuenta_id'] as string,
    bancoId: r['banco_id'] as string,
    monto: r['monto'] as number,
    fecha: r['fecha'] as string,
    descripcion: (r['descripcion'] as string | null) ?? '',
    esTraspaso: (r['es_traspaso'] as number | null) ?? null,
    cuentaParId: (r['cuenta_par_id'] as string | null) ?? null,
    archivado: normalizarArchivado(r['archivado']),
    archivadoEn: (r['archivado_en'] as string | null) ?? null,
  };
}

function operacionVacia(): OperacionArchivo {
  return { ids: [], traspaso: false, ambiguo: false, ajustes: [] };
}

function operacionDesdeId(db: SQLite.SQLiteDatabase, id: string): OperacionArchivo | null {
  const row = db.getFirstSync<Record<string, unknown>>('SELECT * FROM transacciones WHERE id = ?', [id]);
  if (!row) return null;
  const fila = filaArchivoDe(row);
  const candidatas = db.getAllSync<Record<string, unknown>>(
    'SELECT * FROM transacciones WHERE es_traspaso = 1 AND monto = ? AND substr(fecha, 1, 10) = ?',
    [0 - fila.monto, storedDayKey(fila.fecha)]
  ).map(filaArchivoDe);
  return resolverOperacion(fila, candidatas);
}

function marcarArchivado(
  db: SQLite.SQLiteDatabase,
  ids: string[],
  archivado: 0 | 1,
  archivadoEn: string | null
): void {
  if (ids.length === 0) return;
  db.runSync(
    `UPDATE transacciones SET archivado = ?, archivado_en = ? WHERE id IN (${marcadores(ids.length)})`,
    [archivado, archivadoEn, ...ids]
  );
}

function aplicarAjustes(db: SQLite.SQLiteDatabase, ajustes: AjusteCuenta[]): void {
  for (const ajuste of ajustes) {
    db.runSync('UPDATE cuentas SET saldo_actual = saldo_actual + ? WHERE id = ?', [ajuste.delta, ajuste.cuentaId]);
  }
}

export function archivarTransaccion(id: string): OperacionArchivo {
  const db = getDB();
  let operacion = operacionVacia();
  db.withTransactionSync(() => {
    const resuelta = operacionDesdeId(db, id);
    if (!resuelta) return;
    marcarArchivado(db, resuelta.ids, 1, localDateTimeKey());
    invalidarReportesCache();
    operacion = { ...resuelta, ajustes: [] };
  });
  return operacion;
}

export function restaurarTransaccion(id: string): OperacionArchivo {
  const db = getDB();
  let operacion = operacionVacia();
  db.withTransactionSync(() => {
    const resuelta = operacionDesdeId(db, id);
    if (!resuelta) return;
    marcarArchivado(db, resuelta.ids, 0, null);
    invalidarReportesCache();
    operacion = { ...resuelta, ajustes: [] };
  });
  return operacion;
}

export function restaurarTodoElArchivo(): number {
  const db = getDB();
  let restauradas = 0;
  db.withTransactionSync(() => {
    const ids = db.getAllSync<{ id: string }>('SELECT * FROM transacciones WHERE archivado = 1').map(f => f.id);
    marcarArchivado(db, ids, 0, null);
    invalidarReportesCache();
    restauradas = ids.length;
  });
  return restauradas;
}

export function borrarDefinitivoPorId(id: string): OperacionArchivo {
  const db = getDB();
  let operacion = operacionVacia();
  db.withTransactionSync(() => {
    const resuelta = operacionDesdeId(db, id);
    if (!resuelta) return;
    db.runSync(`DELETE FROM transacciones WHERE id IN (${marcadores(resuelta.ids.length)})`, resuelta.ids);
    aplicarAjustes(db, resuelta.ajustes);
    invalidarReportesCache();
    operacion = resuelta;
  });
  return operacion;
}

export function vaciarArchivo(): { operaciones: OperacionArchivo[]; ajustes: AjusteCuenta[] } {
  const db = getDB();
  let resultado: { operaciones: OperacionArchivo[]; ajustes: AjusteCuenta[] } = { operaciones: [], ajustes: [] };
  db.withTransactionSync(() => {
    const filas = db.getAllSync<Record<string, unknown>>('SELECT * FROM transacciones WHERE archivado = 1').map(filaArchivoDe);
    const operaciones = agruparOperaciones(filas);
    const ajustes = ajustesPorCuenta(operaciones);
    const ids = filas.map(f => f.id);
    if (ids.length > 0) {
      db.runSync(`DELETE FROM transacciones WHERE id IN (${marcadores(ids.length)})`, ids);
    }
    aplicarAjustes(db, ajustes);
    invalidarReportesCache();
    resultado = { operaciones, ajustes };
  });
  return resultado;
}

export function getSaldoTotal(): number {
  const row = getDB().getFirstSync<{ total: number }>(
    "SELECT SUM(saldo_actual) AS total FROM cuentas WHERE activa = 1 AND moneda = 'PYG'"
  );
  return row?.total ?? 0;
}

export function getEgresosPorDia(dias: number = 7, ref: Date = new Date()): EgresoDia[] {
  const keys = localLastDaysKeys(ref, dias);
  if (keys.length === 0) return [];
  const desde = keys[0];
  const hasta = keys[keys.length - 1];
  const filas = getDB().getAllSync<FilaMovimiento>(
    `SELECT monto AS monto, fecha AS fecha, es_traspaso AS esTraspaso,
            archivado AS archivado, banco_id AS bancoId, categoria_id AS categoriaId,
            NULL AS categoriaNombre
     FROM transacciones
     WHERE monto < 0 AND archivado = 0 AND substr(fecha, 1, 10) BETWEEN ? AND ?`,
    [desde, hasta]
  );
  return calcularEgresosPorDia(filas, desde, hasta);
}

export function getResumenMesActual(ref: Date = new Date()): Promise<ResumenMes> {
  const mes = localMonthKey(ref);
  const filas = getDB().getAllSync<FilaMovimiento>(
    `SELECT t.monto AS monto, t.fecha AS fecha, t.es_traspaso AS esTraspaso,
            t.archivado AS archivado, t.banco_id AS bancoId, t.categoria_id AS categoriaId,
            c.nombre AS categoriaNombre
     FROM transacciones t
     LEFT JOIN categorias c ON c.id = t.categoria_id
     WHERE t.archivado = 0 AND substr(t.fecha, 1, 7) = ?`,
    [mes]
  );
  return Promise.resolve(calcularResumenMes(filas, mes, 6));
}

export function getGastosPorBanco(mes?: string, ref: Date = new Date()): GastoBanco[] {
  const m = mes ?? localMonthKey(ref);
  const filas = getDB().getAllSync<FilaMovimiento>(
    `SELECT monto AS monto, fecha AS fecha, es_traspaso AS esTraspaso,
            archivado AS archivado, banco_id AS bancoId, categoria_id AS categoriaId,
            NULL AS categoriaNombre
     FROM transacciones
     WHERE monto < 0 AND archivado = 0 AND substr(fecha, 1, 7) = ?`,
    [m]
  );
  return calcularGastosPorBanco(filas, m);
}

export function getNetoHoy(ref: Date = new Date()): number {
  const dia = localDateKey(ref);
  const filas = getDB().getAllSync<FilaMovimiento>(
    `SELECT monto AS monto, fecha AS fecha, es_traspaso AS esTraspaso,
            archivado AS archivado, banco_id AS bancoId, categoria_id AS categoriaId,
            NULL AS categoriaNombre
     FROM transacciones
     WHERE archivado = 0 AND substr(fecha, 1, 10) = ?`,
    [dia]
  );
  return calcularNetoDia(filas, dia);
}

export function getConfig(clave: string): string | null {
  const row = getDB().getFirstSync<{ valor: string }>(
    'SELECT valor FROM configuracion WHERE clave = ?', [clave]
  );
  return row?.valor ?? null;
}

export function setConfig(clave: string, valor: string): void {
  getDB().runSync(
    'INSERT OR REPLACE INTO configuracion (clave, valor) VALUES (?, ?)',
    [clave, valor]
  );
}

export function deleteConfig(clave: string): void {
  getDB().runSync('DELETE FROM configuracion WHERE clave = ?', [clave]);
}

export function getOnboarding(): EstadoOnboarding {
  const completado = getConfig('onboarding_completado');
  const fecha = getConfig('onboarding_fecha');
  const bancos = getConfig('bancos_seleccionados');
  const sms = getConfig('permiso_sms');
  const notif = getConfig('permiso_notif');
  return {
    completado: completado === '1',
    fechaCompletado: fecha,
    bancosSeleccionados: bancos ? JSON.parse(bancos) : [],
    permisoSMS: sms === '1',
    permisoNotif: notif === '1',
  };
}

export function setOnboardingCompletado(datos: Partial<EstadoOnboarding>): void {
  if (datos.completado !== undefined) {
    setConfig('onboarding_completado', datos.completado ? '1' : '0');
    setConfig('onboarding_fecha', new Date().toISOString());
  }
  if (datos.bancosSeleccionados !== undefined) {
    setConfig('bancos_seleccionados', JSON.stringify(datos.bancosSeleccionados));
  }
  if (datos.permisoSMS !== undefined) {
    setConfig('permiso_sms', datos.permisoSMS ? '1' : '0');
  }
  if (datos.permisoNotif !== undefined) {
    setConfig('permiso_notif', datos.permisoNotif ? '1' : '0');
  }
}

export function getCategorias(): Categoria[] {
  return getDB().getAllSync<Record<string, unknown>>(
    'SELECT * FROM categorias ORDER BY id ASC'
  ).map(r => ({
    id: r['id'] as string,
    nombre: r['nombre'] as string,
    icono: r['icono'] as string,
    tinte: r['tinte'] as string,
    tipo: r['tipo'] as Categoria['tipo'],
  }));
}

export function insertCategoriaPersonalizada(cat: Omit<Categoria, 'id'>): Categoria {
  const id = `custom_${cat.nombre.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  getDB().runSync(
    'INSERT OR REPLACE INTO categorias (id, nombre, icono, tinte, tipo) VALUES (?, ?, ?, ?, ?)',
    [id, cat.nombre, cat.icono, cat.tinte, cat.tipo]
  );
  return { ...cat, id };
}

export function deleteCategoria(id: string): void {
  getDB().runSync('DELETE FROM categorias WHERE id = ?', [id]);
}

export function getCategoriasOcultas(): string[] {
  const rows = getDB().getAllSync<{ id: string }>('SELECT id FROM categorias_ocultas');
  return rows.map(r => r.id);
}

export function toggleCategoriaOculta(id: string): boolean {
  const existing = getDB().getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM categorias_ocultas WHERE id = ?', [id]);
  if (existing && existing.n > 0) {
    getDB().runSync('DELETE FROM categorias_ocultas WHERE id = ?', [id]);
    return false;
  } else {
    getDB().runSync('INSERT OR IGNORE INTO categorias_ocultas (id) VALUES (?)', [id]);
    return true;
  }
}

export function getReglas(): ReglaClasificacion[] {
  return getDB().getAllSync<Record<string, unknown>>(
    'SELECT * FROM reglas_clasificacion ORDER BY prioridad DESC'
  ).map(r => ({
    id: r['id'] as string,
    patronTexto: r['patron_texto'] as string,
    categoriaId: r['categoria_id'] as string,
    prioridad: r['prioridad'] as number,
    esRegex: (r['es_regex'] as number) === 1,
  }));
}

export function insertRegla(regla: Omit<ReglaClasificacion, 'id'>): void {
  getDB().runSync(
    `INSERT OR REPLACE INTO reglas_clasificacion
      (id, patron_texto, categoria_id, prioridad, es_regex)
     VALUES (?, ?, ?, ?, ?)`,
    [uuid(), regla.patronTexto, regla.categoriaId, regla.prioridad, regla.esRegex ? 1 : 0]
  );
}

export function getReporteCache(tipo: string, fecha: string): string | null {
  const row = getDB().getFirstSync<{ contenido_json: string }>(
    'SELECT contenido_json FROM reportes_cache WHERE tipo = ? AND fecha = ?',
    [tipo, fecha]
  );
  if (!row) return null;
  try {
    return desencriptarCampo(row.contenido_json);
  } catch (e) {
    console.warn('[DB] No se pudo descifrar el reporte cacheado:', e);
    return row.contenido_json;
  }
}

export function setReporteCache(tipo: string, fecha: string, json: string): void {
  getDB().runSync(
    'INSERT OR REPLACE INTO reportes_cache (id, tipo, fecha, contenido_json) VALUES (?, ?, ?, ?)',
    [uuid(), tipo, fecha, encriptarCampo(json)]
  );
}

export function invalidarReportesCache(): void {
  getDB().runSync('DELETE FROM reportes_cache');
}

export function migrarCamposCifrados(): void {
  try {
    const filasChat = getDB().getAllSync<{ id: string; texto: string }>(
      "SELECT id, texto FROM chat_cache WHERE texto NOT LIKE 'v2:%'"
    );
    for (const fila of filasChat) {
      getDB().runSync('UPDATE chat_cache SET texto = ? WHERE id = ?', [encriptarCampo(fila.texto), fila.id]);
    }
  } catch (e) {
    console.warn('[DB] Migracion cifrado chat_cache:', e);
  }
  try {
    const filasReportes = getDB().getAllSync<{ id: string; contenido_json: string }>(
      "SELECT id, contenido_json FROM reportes_cache WHERE contenido_json NOT LIKE 'v2:%'"
    );
    for (const fila of filasReportes) {
      getDB().runSync('UPDATE reportes_cache SET contenido_json = ? WHERE id = ?', [encriptarCampo(fila.contenido_json), fila.id]);
    }
  } catch (e) {
    console.warn('[DB] Migracion cifrado reportes_cache:', e);
  }
}



export interface MensajeChat {
  id:        string;
  rol:       'user' | 'assistant' | 'system';
  texto:     string;
  fecha:     string;
  sessionId?: string;
}

export function cargarMensajesChat(sessionId?: string): MensajeChat[] {
  const rows = sessionId
    ? getDB().getAllSync<Record<string, unknown>>(
        'SELECT * FROM chat_cache WHERE session_id = ? ORDER BY fecha ASC',
        [sessionId]
      )
    : getDB().getAllSync<Record<string, unknown>>(
        'SELECT * FROM chat_cache ORDER BY fecha ASC'
      );
  return rows.map(r => {
    let texto = r['texto'] as string;
    try {
      texto = desencriptarCampo(texto) ?? '';
    } catch (e) {
      console.warn('[DB] No se pudo descifrar el mensaje de chat:', e);
    }
    return {
      id:        r['id'] as string,
      rol:       r['rol'] as 'user' | 'assistant' | 'system',
      texto,
      fecha:     r['fecha'] as string,
      sessionId: r['session_id'] as string | undefined,
    };
  });
}

export function guardarMensajeChat(msg: Omit<MensajeChat, 'id'> & { sessionId?: string }): MensajeChat {
  const id = uuid();
  getDB().runSync(
    'INSERT INTO chat_cache (id, rol, texto, fecha, session_id) VALUES (?, ?, ?, ?, ?)',
    [id, msg.rol, encriptarCampo(msg.texto), msg.fecha, msg.sessionId ?? null]
  );
  return { ...msg, id };
}

export function getSesionesChat(): { sessionId: string; preview: string; fecha: string }[] {
  const rows = getDB().getAllSync<Record<string, unknown>>(
    `SELECT session_id, texto, fecha FROM chat_cache
     WHERE session_id IS NOT NULL AND rol = 'user'
     AND id IN (
       SELECT id FROM (
         SELECT id, session_id, ROW_NUMBER() OVER (
           PARTITION BY session_id ORDER BY fecha DESC
         ) AS rn FROM chat_cache WHERE rol = 'user'
       ) WHERE rn = 1
     )
     ORDER BY fecha DESC`
  );
  return rows.map(r => {
    let preview: string;
    try {
      preview = (desencriptarCampo(r['texto'] as string) ?? '').slice(0, 60);
    } catch (e) {
      console.warn('[DB] No se pudo descifrar la sesión de chat:', e);
      preview = ((r['texto'] as string) ?? '').slice(0, 60);
    }
    return {
      sessionId: r['session_id'] as string,
      preview,
      fecha:     r['fecha'] as string,
    };
  });
}

export function eliminarSesionChat(sessionId: string): void {
  getDB().runSync('DELETE FROM chat_cache WHERE session_id = ?', [sessionId]);
}

export function limpiarChat(): void {
  getDB().runSync('DELETE FROM chat_cache');
}



export { getDB as getDB };



export async function getCuentasAsync(): Promise<CuentaBancaria[]> {
  return Promise.resolve(getCuentas());
}
export async function getSaldoTotalAsync(): Promise<number> {
  return Promise.resolve(getSaldoTotal());
}
export async function getCategoriasAsync(): Promise<Categoria[]> {
  return Promise.resolve(getCategorias());
}
export async function getConfigAsync(clave: string): Promise<string | null> {
  return Promise.resolve(getConfig(clave));
}
export async function getOnboardingAsync(): Promise<EstadoOnboarding> {
  return Promise.resolve(getOnboarding());
}
export function insertarNotificacion(titulo: string, cuerpo: string, tipo: string = 'info'): void {
  getDB().runSync(
    'INSERT INTO notificaciones (id, titulo, cuerpo, tipo) VALUES (?, ?, ?, ?)',
    [uuid(), titulo, cuerpo, tipo]
  );
}

export function getNotificaciones(): NotificacionApp[] {
  return getDB().getAllSync<Record<string, unknown>>(
    `SELECT id, titulo, cuerpo, tipo, leida, eliminada, fecha_creacion AS fechaCreacion
     FROM notificaciones WHERE eliminada = 0 ORDER BY fecha_creacion DESC`
  ).map(r => ({
    id: r['id'] as string,
    titulo: r['titulo'] as string,
    cuerpo: r['cuerpo'] as string,
    tipo: r['tipo'] as NotificacionApp['tipo'],
    leida: (r['leida'] as number) === 1,
    eliminada: (r['eliminada'] as number) === 1,
    fechaCreacion: r['fechaCreacion'] as string,
  }));
}

export function marcarNotifLeida(id: string): void {
  getDB().runSync('UPDATE notificaciones SET leida = 1 WHERE id = ?', [id]);
}

export function marcarNotifEliminada(id: string): void {
  getDB().runSync('UPDATE notificaciones SET eliminada = 1 WHERE id = ?', [id]);
}

export function getCantidadNoLeidas(): number {
  const row = getDB().getFirstSync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM notificaciones WHERE leida = 0 AND eliminada = 0'
  );
  return row?.n ?? 0;
}

export function notifBienvenidaPendiente(): boolean {
  const row = getDB().getFirstSync<{ n: number }>(
    "SELECT COUNT(*) AS n FROM notificaciones WHERE tipo = 'bienvenida'"
  );
  return !row || row.n === 0;
}

export function notificarTransaccion(titulo: string, cuerpo: string): void {
  insertarNotificacion(titulo, cuerpo, 'alerta');
  try {
    const Notifications = require('expo-notifications');
    Notifications.scheduleNotificationAsync({
      content: { title: titulo, body: 'Abrí la app para verlo.', data: { screen: 'notificaciones' }, sound: true },
      trigger: null,
    }).catch(() => {});
  } catch { console.warn('[DB] Error en operación'); }
}

export async function getTransaccionesAsync(opciones?: Parameters<typeof getTransacciones>[0]): Promise<Transaccion[]> {
  return getTransacciones(opciones);
}
export async function getResumenMesActualAsync(ref?: Date): Promise<ResumenMes> {
  return getResumenMesActual(ref);
}
export async function setOnboardingCompletadoAsync(datos: Partial<EstadoOnboarding>): Promise<void> {
  return Promise.resolve(setOnboardingCompletado(datos));
}
export async function setConfigAsync(clave: string, valor: string): Promise<void> {
  return Promise.resolve(setConfig(clave, valor));
}
export async function insertCuentaAsync(cuenta: Omit<CuentaBancaria, 'id' | 'fechaCreacion'>): Promise<CuentaBancaria> {
  return Promise.resolve(insertCuenta(cuenta));
}
export async function insertTransaccionAsync(tx: Omit<Transaccion, 'id'>): Promise<Transaccion> {
  return insertTransaccion(tx);
}
export async function updateCategoriaAsync(txId: string, categoriaId: string): Promise<void> {
  return Promise.resolve(updateCategoria(txId, categoriaId));
}
export async function deleteCuentaAsync(cuentaId: string): Promise<void> {
  return Promise.resolve(deleteCuenta(cuentaId));
}
export async function getGastosPorBancoAsync(mes?: string, ref?: Date): Promise<GastoBanco[]> {
  return Promise.resolve(getGastosPorBanco(mes, ref));
}
export async function getCategoriasOcultasAsync(): Promise<string[]> {
  return Promise.resolve(getCategoriasOcultas());
}
export async function toggleCategoriaOcultaAsync(id: string): Promise<boolean> {
  return Promise.resolve(toggleCategoriaOculta(id));
}
