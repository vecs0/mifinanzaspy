// services/database.ts — Capa de acceso a SQLite con Expo SQLite
// Base de datos local, offline-first. Todos los montos en Guaraníes (PYG).
import * as SQLite from 'expo-sqlite';
import { CATEGORIAS } from '@/constants/categories';
import type {
  CuentaBancaria, Transaccion, Categoria,
  ReglaClasificacion, ReporteCache, EstadoOnboarding,
  ProyeccionMes, EstadoSalud,
} from '@/types/finance';

// ─── Instancia única de la DB ────────────────────────────────────
let db: SQLite.SQLiteDatabase | null = null;

export async function getDB(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync('finanzas_py.db');
    await initSchema(db);
  }
  return db;
}

// ─── Inicialización del esquema ──────────────────────────────────

export async function initSchema(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync(`PRAGMA journal_mode = WAL;`);
  await database.execAsync(`PRAGMA foreign_keys = ON;`);

  await database.execAsync(`
    -- ── Tabla: cuentas ───────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS cuentas (
      id               TEXT PRIMARY KEY,
      banco_id         TEXT NOT NULL,
      banco_nombre     TEXT NOT NULL,
      app_package      TEXT NOT NULL DEFAULT '',
      tipo_cuenta      TEXT NOT NULL DEFAULT 'corriente',
      alias            TEXT NOT NULL,
      saldo_actual     INTEGER NOT NULL DEFAULT 0,
      moneda           TEXT NOT NULL DEFAULT 'PYG',
      activa           INTEGER NOT NULL DEFAULT 1,
      sms_habilitado   INTEGER NOT NULL DEFAULT 1,
      notif_habilitada INTEGER NOT NULL DEFAULT 1,
      color            TEXT NOT NULL DEFAULT '#B36A2A',
      icono            TEXT NOT NULL DEFAULT 'bank',
      fecha_creacion   TEXT NOT NULL
    );

    -- ── Tabla: transacciones ─────────────────────────────────────
    CREATE TABLE IF NOT EXISTS transacciones (
      id           TEXT PRIMARY KEY,
      cuenta_id    TEXT NOT NULL REFERENCES cuentas(id) ON DELETE CASCADE,
      banco_id     TEXT NOT NULL,
      monto        INTEGER NOT NULL,
      tipo         TEXT NOT NULL,
      categoria_id TEXT NOT NULL DEFAULT 'otros',
      descripcion  TEXT NOT NULL DEFAULT '',
      fuente       TEXT NOT NULL DEFAULT 'manual',
      fecha        TEXT NOT NULL,
      saldo_post   INTEGER,
      sms_raw      TEXT,
      procesado    INTEGER NOT NULL DEFAULT 0,
      notas        TEXT,
      created_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_tx_cuenta  ON transacciones(cuenta_id);
    CREATE INDEX IF NOT EXISTS idx_tx_fecha   ON transacciones(fecha DESC);
    CREATE INDEX IF NOT EXISTS idx_tx_banco   ON transacciones(banco_id);
    CREATE INDEX IF NOT EXISTS idx_tx_cat     ON transacciones(categoria_id);

    -- ── Tabla: categorias ────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS categorias (
      id     TEXT PRIMARY KEY,
      nombre TEXT NOT NULL,
      icono  TEXT NOT NULL DEFAULT 'dots',
      tinte  TEXT NOT NULL DEFAULT '#6B7280',
      tipo   TEXT NOT NULL DEFAULT 'mixto'
    );

    -- ── Tabla: reglas_clasificacion ──────────────────────────────
    CREATE TABLE IF NOT EXISTS reglas_clasificacion (
      id           TEXT PRIMARY KEY,
      patron_texto TEXT NOT NULL,
      categoria_id TEXT NOT NULL REFERENCES categorias(id),
      prioridad    INTEGER NOT NULL DEFAULT 0,
      es_regex     INTEGER NOT NULL DEFAULT 0
    );

    -- ── Tabla: reportes_cache ────────────────────────────────────
    CREATE TABLE IF NOT EXISTS reportes_cache (
      id             TEXT PRIMARY KEY,
      tipo           TEXT NOT NULL,
      fecha          TEXT NOT NULL,
      contenido_json TEXT NOT NULL,
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(tipo, fecha)
    );

    -- ── Tabla: configuracion ─────────────────────────────────────
    CREATE TABLE IF NOT EXISTS configuracion (
      clave TEXT PRIMARY KEY,
      valor TEXT NOT NULL
    );
  `);

  // Poblar categorías predefinidas si la tabla está vacía
  const count = await database.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM categorias'
  );
  if (count && count.n === 0) {
    await database.withTransactionAsync(async () => {
      for (const cat of CATEGORIAS) {
        await database.runAsync(
          'INSERT OR IGNORE INTO categorias (id, nombre, icono, tinte, tipo) VALUES (?, ?, ?, ?, ?)',
          [cat.id, cat.nombre, cat.icono, cat.tinte, cat.tipo]
        );
      }
    });
  }
}

// ─── Helpers ─────────────────────────────────────────────────────

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function now(): string {
  return new Date().toISOString();
}

// ─── CUENTAS ─────────────────────────────────────────────────────

export async function getCuentas(): Promise<CuentaBancaria[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM cuentas WHERE activa = 1 ORDER BY fecha_creacion ASC'
  );
  return rows.map(mapCuenta);
}

export async function insertCuenta(
  cuenta: Omit<CuentaBancaria, 'id' | 'fechaCreacion'>
): Promise<CuentaBancaria> {
  const db = await getDB();
  const id = uuid();
  const fecha = now();
  await db.runAsync(
    `INSERT INTO cuentas
      (id, banco_id, banco_nombre, app_package, tipo_cuenta, alias,
       saldo_actual, moneda, activa, sms_habilitado, notif_habilitada,
       color, icono, fecha_creacion)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, cuenta.bancoId, cuenta.bancoNombre, cuenta.appPackage,
      cuenta.tipoCuenta, cuenta.alias, cuenta.saldoActual, cuenta.moneda,
      cuenta.activa ? 1 : 0,
      cuenta.smsHabilitado ? 1 : 0,
      cuenta.notifHabilitada ? 1 : 0,
      cuenta.color, cuenta.icono, fecha,
    ]
  );
  return { ...cuenta, id, fechaCreacion: fecha };
}

export async function updateSaldoCuenta(cuentaId: string, saldo: number): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    'UPDATE cuentas SET saldo_actual = ? WHERE id = ?',
    [saldo, cuentaId]
  );
}

export async function deleteCuenta(cuentaId: string): Promise<void> {
  const db = await getDB();
  // Soft delete — solo desactiva
  await db.runAsync('UPDATE cuentas SET activa = 0 WHERE id = ?', [cuentaId]);
}

// ─── TRANSACCIONES ───────────────────────────────────────────────

export async function getTransacciones(opciones: {
  cuentaId?: string;
  bancoId?: string;
  categoriaId?: string;
  desde?: string;
  hasta?: string;
  limite?: number;
  offset?: number;
} = {}): Promise<Transaccion[]> {
  const db = await getDB();
  const condiciones: string[] = [];
  const params: (string | number)[] = [];

  if (opciones.cuentaId)    { condiciones.push('cuenta_id = ?');    params.push(opciones.cuentaId); }
  if (opciones.bancoId)     { condiciones.push('banco_id = ?');     params.push(opciones.bancoId); }
  if (opciones.categoriaId) { condiciones.push('categoria_id = ?'); params.push(opciones.categoriaId); }
  if (opciones.desde)       { condiciones.push('fecha >= ?');       params.push(opciones.desde); }
  if (opciones.hasta)       { condiciones.push('fecha <= ?');       params.push(opciones.hasta); }

  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  const limit = opciones.limite ?? 100;
  const offset = opciones.offset ?? 0;

  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM transacciones ${where} ORDER BY fecha DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  return rows.map(mapTransaccion);
}

export async function insertTransaccion(
  tx: Omit<Transaccion, 'id'>
): Promise<Transaccion> {
  const db = await getDB();
  const id = uuid();
  await db.runAsync(
    `INSERT INTO transacciones
      (id, cuenta_id, banco_id, monto, tipo, categoria_id, descripcion,
       fuente, fecha, saldo_post, sms_raw, procesado, notas)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, tx.cuentaId, tx.bancoId, tx.monto, tx.tipo, tx.categoriaId,
      tx.descripcion, tx.fuente, tx.fecha,
      tx.saldoPost ?? null, tx.smsRaw ?? null,
      tx.procesado ? 1 : 0, tx.notas ?? null,
    ]
  );
  // Actualizar saldo de la cuenta
  await db.runAsync(
    'UPDATE cuentas SET saldo_actual = saldo_actual + ? WHERE id = ?',
    [tx.monto, tx.cuentaId]
  );
  return { ...tx, id };
}

export async function updateCategoria(txId: string, categoriaId: string): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    'UPDATE transacciones SET categoria_id = ?, procesado = 1 WHERE id = ?',
    [categoriaId, txId]
  );
}

// ─── RESÚMENES CALCULADOS (queries directas) ────────────────────

/** Saldo total consolidado de todas las cuentas activas en PYG */
export async function getSaldoTotal(): Promise<number> {
  const db = await getDB();
  const row = await db.getFirstAsync<{ total: number }>(
    "SELECT SUM(saldo_actual) AS total FROM cuentas WHERE activa = 1 AND moneda = 'PYG'"
  );
  return row?.total ?? 0;
}

/** Egresos agrupados por día — últimos N días */
export async function getEgresosPorDia(dias: number = 7): Promise<{ fecha: string; total: number }[]> {
  const db = await getDB();
  const desde = new Date();
  desde.setDate(desde.getDate() - dias + 1);
  const desdeStr = desde.toISOString().slice(0, 10);

  const rows = await db.getAllAsync<{ fecha: string; total: number }>(
    `SELECT substr(fecha, 1, 10) AS fecha, SUM(ABS(monto)) AS total
     FROM transacciones
     WHERE monto < 0 AND substr(fecha, 1, 10) >= ?
     GROUP BY substr(fecha, 1, 10)
     ORDER BY fecha ASC`,
    [desdeStr]
  );
  return rows;
}

/** Ingresos y egresos del mes actual */
export async function getResumenMesActual(): Promise<{
  ingresos: number;
  egresos: number;
  topCategorias: { categoriaId: string; total: number }[];
}> {
  const db = await getDB();
  const mesActual = new Date().toISOString().slice(0, 7); // "2026-05"

  const totales = await db.getFirstAsync<{ ingresos: number; egresos: number }>(
    `SELECT
       SUM(CASE WHEN monto > 0 THEN monto ELSE 0 END) AS ingresos,
       SUM(CASE WHEN monto < 0 THEN ABS(monto) ELSE 0 END) AS egresos
     FROM transacciones
     WHERE substr(fecha, 1, 7) = ?`,
    [mesActual]
  );

  const topCats = await db.getAllAsync<{ categoriaId: string; total: number }>(
    `SELECT categoria_id AS categoriaId, SUM(ABS(monto)) AS total
     FROM transacciones
     WHERE monto < 0 AND substr(fecha, 1, 7) = ?
     GROUP BY categoria_id
     ORDER BY total DESC
     LIMIT 5`,
    [mesActual]
  );

  return {
    ingresos: totales?.ingresos ?? 0,
    egresos: totales?.egresos ?? 0,
    topCategorias: topCats,
  };
}

// ─── CONFIGURACIÓN / ONBOARDING ─────────────────────────────────

export async function getConfig(clave: string): Promise<string | null> {
  const db = await getDB();
  const row = await db.getFirstAsync<{ valor: string }>(
    'SELECT valor FROM configuracion WHERE clave = ?',
    [clave]
  );
  return row?.valor ?? null;
}

export async function setConfig(clave: string, valor: string): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    'INSERT OR REPLACE INTO configuracion (clave, valor) VALUES (?, ?)',
    [clave, valor]
  );
}

export async function getOnboarding(): Promise<EstadoOnboarding> {
  const [completado, fecha, bancos, sms, notif] = await Promise.all([
    getConfig('onboarding_completado'),
    getConfig('onboarding_fecha'),
    getConfig('bancos_seleccionados'),
    getConfig('permiso_sms'),
    getConfig('permiso_notif'),
  ]);
  return {
    completado: completado === '1',
    fechaCompletado: fecha,
    bancosSeleccionados: bancos ? JSON.parse(bancos) : [],
    permisoSMS: sms === '1',
    permisoNotif: notif === '1',
  };
}

export async function setOnboardingCompletado(datos: Partial<EstadoOnboarding>): Promise<void> {
  const db2 = await getDB();
  await db2.withTransactionAsync(async () => {
    if (datos.completado !== undefined) {
      await setConfig('onboarding_completado', datos.completado ? '1' : '0');
      await setConfig('onboarding_fecha', new Date().toISOString());
    }
    if (datos.bancosSeleccionados !== undefined) {
      await setConfig('bancos_seleccionados', JSON.stringify(datos.bancosSeleccionados));
    }
    if (datos.permisoSMS !== undefined) {
      await setConfig('permiso_sms', datos.permisoSMS ? '1' : '0');
    }
    if (datos.permisoNotif !== undefined) {
      await setConfig('permiso_notif', datos.permisoNotif ? '1' : '0');
    }
  });
}

// ─── CATEGORÍAS ──────────────────────────────────────────────────

export async function getCategorias(): Promise<Categoria[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM categorias ORDER BY nombre ASC'
  );
  return rows.map(r => ({
    id:   r['id'] as string,
    nombre: r['nombre'] as string,
    icono:  r['icono'] as string,
    tinte:  r['tinte'] as string,
    tipo:   r['tipo'] as Categoria['tipo'],
  }));
}

/** Calcula la proyección financiera del mes basado en transacciones y saldos */
export function calcularProyeccion(
  transacciones: Transaccion[],
  cuentas: CuentaBancaria[],
): ProyeccionMes {
  const ahora = new Date();
  const mesActual = ahora.toISOString().slice(0, 7);
  const diasEnMes = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0).getDate();
  const diaActual = ahora.getDate();
  const diasRestantes = diasEnMes - diaActual;

  const txsMes = transacciones.filter(t => t.fecha.slice(0, 7) === mesActual);
  const totalIngresos = txsMes.filter(t => t.monto > 0).reduce((s, t) => s + t.monto, 0);
  const totalEgresos = txsMes.filter(t => t.monto < 0).reduce((s, t) => s + Math.abs(t.monto), 0);

  const saldoTotal = cuentas.reduce((s, c) => s + c.saldoActual, 0);

  const promedioDiarioEgreso = diaActual > 0 ? totalEgresos / diaActual : 0;
  const gastoProyectado = Math.round(promedioDiarioEgreso * diasEnMes);
  const pctIngresoGastado = totalIngresos > 0 ? (totalEgresos / totalIngresos) * 100 : 100;
  const saldoProyectado = Math.round(saldoTotal - promedioDiarioEgreso * diasRestantes);

  let estadoSalud: EstadoSalud;
  if (pctIngresoGastado < 70 && saldoProyectado > 0) {
    estadoSalud = 'estable';
  } else if (pctIngresoGastado < 100 || saldoProyectado > 0) {
    estadoSalud = 'atencion';
  } else {
    estadoSalud = 'riesgo';
  }

  return {
    diasRestantes,
    gastoProyectado,
    ingresoEstimado: Math.round(totalIngresos / Math.max(1, diaActual) * diasEnMes),
    saldoProyectado,
    pctIngresoGastado: Math.round(pctIngresoGastado),
    estadoSalud,
  };
}

// ─── REGLAS DE CLASIFICACIÓN ─────────────────────────────────────

export async function getReglas(): Promise<ReglaClasificacion[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM reglas_clasificacion ORDER BY prioridad DESC'
  );
  return rows.map(r => ({
    id:          r['id'] as string,
    patronTexto: r['patron_texto'] as string,
    categoriaId: r['categoria_id'] as string,
    prioridad:   r['prioridad'] as number,
    esRegex:     (r['es_regex'] as number) === 1,
  }));
}

export async function insertRegla(
  regla: Omit<ReglaClasificacion, 'id'>
): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    `INSERT OR REPLACE INTO reglas_clasificacion
      (id, patron_texto, categoria_id, prioridad, es_regex)
     VALUES (?, ?, ?, ?, ?)`,
    [uuid(), regla.patronTexto, regla.categoriaId, regla.prioridad, regla.esRegex ? 1 : 0]
  );
}

// ─── CACHE DE REPORTES ───────────────────────────────────────────

export async function getReporteCache(tipo: string, fecha: string): Promise<string | null> {
  const db = await getDB();
  const row = await db.getFirstAsync<{ contenido_json: string }>(
    'SELECT contenido_json FROM reportes_cache WHERE tipo = ? AND fecha = ?',
    [tipo, fecha]
  );
  return row?.contenido_json ?? null;
}

export async function setReporteCache(tipo: string, fecha: string, json: string): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    `INSERT OR REPLACE INTO reportes_cache (id, tipo, fecha, contenido_json)
     VALUES (?, ?, ?, ?)`,
    [uuid(), tipo, fecha, json]
  );
}

// ─── Mappers fila DB → objeto TypeScript ────────────────────────

function mapCuenta(r: Record<string, unknown>): CuentaBancaria {
  return {
    id:              r['id'] as string,
    bancoId:         r['banco_id'] as string,
    bancoNombre:     r['banco_nombre'] as string,
    appPackage:      r['app_package'] as string,
    tipoCuenta:      r['tipo_cuenta'] as CuentaBancaria['tipoCuenta'],
    alias:           r['alias'] as string,
    saldoActual:     r['saldo_actual'] as number,
    moneda:          r['moneda'] as CuentaBancaria['moneda'],
    activa:          (r['activa'] as number) === 1,
    smsHabilitado:   (r['sms_habilitado'] as number) === 1,
    notifHabilitada: (r['notif_habilitada'] as number) === 1,
    color:           r['color'] as string,
    icono:           r['icono'] as string,
    fechaCreacion:   r['fecha_creacion'] as string,
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
  };
}
