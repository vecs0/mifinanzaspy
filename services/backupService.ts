/**
 * backupService
 * Responsabilidad: Backup cifrado zero-knowledge (passphrase del usuario), restore y export CSV
 * Usado por: components/BackupSection
 * Depende de: database, metas, encryption, tweetnacl, expo-crypto, expo-file-system, expo-sharing, expo-document-picker
 * Formato: cabecera binaria (magic, version, kdf, iteraciones, salt, nonce) + nacl.secretbox del JSON completo
 */
import nacl from 'tweetnacl';
import { getRandomBytesAsync } from 'expo-crypto';
import { getDB } from '@/services/database';
import { asegurarTablaMetas } from '@/services/metas';
import { encrypt, decrypt } from '@/services/encryption';
import { normalizarArchivado } from '@/services/archivo';

export const BACKUP_FORMAT_VERSION = 1;
export const BACKUP_SCHEMA_VERSION = 1;
export const KDF_ITERACIONES_DEFAULT = 100000;
export const PASSPHRASE_MIN = 8;

const KDF_ITERACIONES_MIN = 1000;
const KDF_ITERACIONES_MAX = 2000000;
const MAGIC = new Uint8Array([0x4d, 0x46, 0x50, 0x59, 0x42, 0x4b]);
const KDF_PBKDF2_SHA512 = 1;
const SALT_LEN = 16;
const NONCE_LEN = 24;
const HEADER_LEN = MAGIC.length + 1 + 1 + 4 + SALT_LEN + NONCE_LEN;
const HMAC_BLOCK = 128;
const CEDER_CADA = 2000;

export const TABLAS_BACKUP = [
  'categorias',
  'cuentas',
  'categorias_ocultas',
  'reglas_clasificacion',
  'presupuestos',
  'recordatorios',
  'metas',
  'transacciones',
  'configuracion',
] as const;

export type TablaBackup = typeof TABLAS_BACKUP[number];
export type FilaBackup = Record<string, string | number | null>;
export type ModoRestore = 'reemplazar' | 'combinar';

export interface PayloadBackup {
  version: number;
  createdAt: string;
  tables: Record<string, FilaBackup[]>;
}

export interface ResultadoExport {
  uri: string;
  nombre: string;
  conteos: Record<string, number>;
  camposNoDescifrables: number;
  archivados: number;
}

export interface ResultadoRestore {
  modo: ModoRestore;
  antes: Record<string, number>;
  despues: Record<string, number>;
  insertados: Record<string, number>;
  omitidos: number;
  omitidosArchivados: number;
  archivadoNormalizado: number;
}

export type CodigoErrorBackup =
  | 'passphrase_corta'
  | 'passphrase_incorrecta'
  | 'formato_invalido'
  | 'version_no_soportada'
  | 'esquema_invalido'
  | 'archivo_no_disponible'
  | 'compartir_no_disponible'
  | 'restore_fallido';

export class BackupError extends Error {
  codigo: CodigoErrorBackup;
  constructor(codigo: CodigoErrorBackup, mensaje: string) {
    super(mensaje);
    this.name = 'BackupError';
    this.codigo = codigo;
  }
}

const ORDEN_BORRADO: TablaBackup[] = [...TABLAS_BACKUP].reverse();

function concat(...partes: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const p of partes) total += p.length;
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of partes) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

function hmacSha512(key: Uint8Array, msg: Uint8Array): Uint8Array {
  const k = key.length > HMAC_BLOCK ? nacl.hash(key) : key;
  const ipad = new Uint8Array(HMAC_BLOCK).fill(0x36);
  const opad = new Uint8Array(HMAC_BLOCK).fill(0x5c);
  for (let i = 0; i < k.length; i++) {
    ipad[i] ^= k[i];
    opad[i] ^= k[i];
  }
  return nacl.hash(concat(opad, nacl.hash(concat(ipad, msg))));
}

function cederTurno(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

export async function derivarClave(
  passphrase: string,
  salt: Uint8Array,
  iteraciones: number
): Promise<Uint8Array> {
  const pass = new TextEncoder().encode(passphrase.normalize('NFKC'));
  const bloque = concat(salt, new Uint8Array([0, 0, 0, 1]));
  let u = hmacSha512(pass, bloque);
  const t = Uint8Array.from(u);
  for (let i = 1; i < iteraciones; i++) {
    u = hmacSha512(pass, u);
    for (let j = 0; j < t.length; j++) t[j] ^= u[j];
    if (i % CEDER_CADA === 0) await cederTurno();
  }
  return t.slice(0, nacl.secretbox.keyLength);
}

function escribirU32(valor: number): Uint8Array {
  return new Uint8Array([(valor >>> 24) & 255, (valor >>> 16) & 255, (valor >>> 8) & 255, valor & 255]);
}

function leerU32(buf: Uint8Array, off: number): number {
  return ((buf[off] << 24) | (buf[off + 1] << 16) | (buf[off + 2] << 8) | buf[off + 3]) >>> 0;
}

export async function empaquetarBackup(
  payload: PayloadBackup,
  passphrase: string,
  opciones: { iteraciones?: number } = {}
): Promise<Uint8Array> {
  if (passphrase.length < PASSPHRASE_MIN) {
    throw new BackupError('passphrase_corta', `La contraseña debe tener al menos ${PASSPHRASE_MIN} caracteres`);
  }
  const iteraciones = opciones.iteraciones ?? KDF_ITERACIONES_DEFAULT;
  const salt = new Uint8Array(await getRandomBytesAsync(SALT_LEN));
  const nonce = new Uint8Array(await getRandomBytesAsync(NONCE_LEN));
  const clave = await derivarClave(passphrase, salt, iteraciones);
  const cifrado = nacl.secretbox(new TextEncoder().encode(JSON.stringify(payload)), nonce, clave);
  clave.fill(0);
  return concat(
    MAGIC,
    new Uint8Array([BACKUP_FORMAT_VERSION, KDF_PBKDF2_SHA512]),
    escribirU32(iteraciones),
    salt,
    nonce,
    cifrado
  );
}

export async function desempaquetarBackup(bytes: Uint8Array, passphrase: string): Promise<PayloadBackup> {
  if (bytes.length <= HEADER_LEN + nacl.secretbox.overheadLength) {
    throw new BackupError('formato_invalido', 'El archivo no es una copia de seguridad valida');
  }
  for (let i = 0; i < MAGIC.length; i++) {
    if (bytes[i] !== MAGIC[i]) {
      throw new BackupError('formato_invalido', 'El archivo no es una copia de seguridad valida');
    }
  }
  const formato = bytes[MAGIC.length];
  const kdf = bytes[MAGIC.length + 1];
  if (formato !== BACKUP_FORMAT_VERSION || kdf !== KDF_PBKDF2_SHA512) {
    throw new BackupError('version_no_soportada', 'La copia fue creada con una version incompatible de la app');
  }
  const iteraciones = leerU32(bytes, MAGIC.length + 2);
  if (iteraciones < KDF_ITERACIONES_MIN || iteraciones > KDF_ITERACIONES_MAX) {
    throw new BackupError('formato_invalido', 'El archivo no es una copia de seguridad valida');
  }
  const offSalt = MAGIC.length + 6;
  const salt = bytes.slice(offSalt, offSalt + SALT_LEN);
  const nonce = bytes.slice(offSalt + SALT_LEN, HEADER_LEN);
  const cifrado = bytes.slice(HEADER_LEN);
  const clave = await derivarClave(passphrase, salt, iteraciones);
  const plano = nacl.secretbox.open(cifrado, nonce, clave);
  clave.fill(0);
  if (!plano) {
    throw new BackupError('passphrase_incorrecta', 'Contraseña incorrecta o archivo dañado');
  }
  let payload: unknown;
  try {
    payload = JSON.parse(new TextDecoder().decode(plano));
  } catch {
    throw new BackupError('esquema_invalido', 'El contenido de la copia no es valido');
  }
  return validarPayload(payload);
}

function esFila(v: unknown): v is FilaBackup {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
  return Object.values(v).every(x => x === null || typeof x === 'string' || typeof x === 'number');
}

export function validarPayload(p: unknown): PayloadBackup {
  if (typeof p !== 'object' || p === null) {
    throw new BackupError('esquema_invalido', 'El contenido de la copia no es valido');
  }
  const o = p as Record<string, unknown>;
  if (typeof o.version !== 'number' || !Number.isInteger(o.version)) {
    throw new BackupError('esquema_invalido', 'La copia no tiene version');
  }
  if (o.version !== BACKUP_SCHEMA_VERSION) {
    throw new BackupError(
      'version_no_soportada',
      o.version > BACKUP_SCHEMA_VERSION
        ? 'La copia fue creada con una version mas nueva de la app. Actualiza la app para restaurarla'
        : 'La copia fue creada con una version antigua no soportada'
    );
  }
  if (typeof o.createdAt !== 'string' || typeof o.tables !== 'object' || o.tables === null) {
    throw new BackupError('esquema_invalido', 'El contenido de la copia no es valido');
  }
  const tablas = o.tables as Record<string, unknown>;
  const limpias: Record<string, FilaBackup[]> = {};
  for (const nombre of TABLAS_BACKUP) {
    const filas = tablas[nombre] ?? [];
    if (!Array.isArray(filas) || !filas.every(esFila)) {
      throw new BackupError('esquema_invalido', `Tabla invalida en la copia: ${nombre}`);
    }
    limpias[nombre] = filas;
  }
  for (const nombre of TABLAS_BACKUP) {
    const campo = nombre === 'configuracion' ? 'clave' : 'id';
    if (limpias[nombre].some(f => typeof f[campo] !== 'string')) {
      throw new BackupError('esquema_invalido', `Fila sin ${campo} en ${nombre}`);
    }
  }
  const cuentaIds = new Set(limpias.cuentas.map(c => c.id));
  for (const t of limpias.transacciones) {
    if (!cuentaIds.has(t.cuenta_id)) {
      throw new BackupError('esquema_invalido', 'Transaccion con referencias invalidas');
    }
    if (typeof t.monto !== 'number' || !Number.isInteger(t.monto)) {
      throw new BackupError('esquema_invalido', 'Transaccion con monto invalido');
    }
  }
  return { version: o.version, createdAt: o.createdAt, tables: limpias };
}

async function descifrarCampo(valor: unknown): Promise<{ texto: string | null; fallo: boolean }> {
  if (typeof valor !== 'string' || valor === '') return { texto: null, fallo: false };
  try {
    const t = await decrypt(valor);
    if (t === null) return { texto: null, fallo: true };
    return { texto: t, fallo: false };
  } catch {
    return { texto: null, fallo: true };
  }
}

function leerTablas(): Record<string, FilaBackup[]> {
  const db = getDB();
  asegurarTablaMetas();
  const out: Record<string, FilaBackup[]> = {};
  for (const t of TABLAS_BACKUP) {
    out[t] = db.getAllSync<FilaBackup>(`SELECT * FROM ${t}`);
  }
  return out;
}

export async function construirPayload(): Promise<{
  payload: PayloadBackup;
  camposNoDescifrables: number;
  archivados: number;
}> {
  const tables = leerTablas();
  let camposNoDescifrables = 0;
  let archivados = 0;
  const tx: FilaBackup[] = [];
  for (const fila of tables.transacciones) {
    const desc = await descifrarCampo(fila.descripcion);
    const sms = await descifrarCampo(fila.sms_raw);
    if (desc.fallo) camposNoDescifrables++;
    if (sms.fallo) camposNoDescifrables++;
    if (normalizarArchivado(fila.archivado) === 1) archivados++;
    tx.push({ ...fila, descripcion: desc.texto ?? '', sms_raw: sms.texto });
  }
  tables.transacciones = tx;
  return {
    payload: { version: BACKUP_SCHEMA_VERSION, createdAt: new Date().toISOString(), tables },
    camposNoDescifrables,
    archivados,
  };
}

function marcaTiempo(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

async function cargarFileSystem(): Promise<typeof import('expo-file-system')> {
  try {
    return await import('expo-file-system');
  } catch {
    throw new BackupError('archivo_no_disponible', 'Funcion no disponible en este dispositivo');
  }
}

async function escribirYCompartir(
  nombre: string,
  contenido: string | Uint8Array,
  mimeType: string
): Promise<string> {
  const FS = await cargarFileSystem();
  let Sharing: typeof import('expo-sharing');
  try {
    Sharing = await import('expo-sharing');
  } catch {
    throw new BackupError('compartir_no_disponible', 'Compartir no esta disponible en este dispositivo');
  }
  let uri: string;
  try {
    const archivo = new FS.File(FS.Paths.cache, nombre);
    if (archivo.exists) archivo.delete();
    archivo.create();
    archivo.write(contenido);
    uri = archivo.uri;
  } catch (e) {
    console.warn('[Backup] Error escribiendo archivo:', e);
    throw new BackupError('archivo_no_disponible', 'No se pudo crear el archivo');
  }
  let disponible = false;
  try {
    disponible = await Sharing.isAvailableAsync();
  } catch {
    disponible = false;
  }
  if (!disponible) {
    throw new BackupError('compartir_no_disponible', 'Compartir no esta disponible en este dispositivo');
  }
  await Sharing.shareAsync(uri, { mimeType, dialogTitle: nombre });
  return uri;
}

export async function exportarBackup(
  passphrase: string,
  opciones: { iteraciones?: number } = {}
): Promise<ResultadoExport> {
  if (passphrase.length < PASSPHRASE_MIN) {
    throw new BackupError('passphrase_corta', `La contraseña debe tener al menos ${PASSPHRASE_MIN} caracteres`);
  }
  const { payload, camposNoDescifrables, archivados } = await construirPayload();
  const bytes = await empaquetarBackup(payload, passphrase, opciones);
  const nombre = `mifinanzaspy-backup-${marcaTiempo()}.mfbk`;
  const uri = await escribirYCompartir(nombre, bytes, 'application/octet-stream');
  const conteos: Record<string, number> = {};
  for (const t of TABLAS_BACKUP) conteos[t] = payload.tables[t].length;
  return { uri, nombre, conteos, camposNoDescifrables, archivados };
}

export async function seleccionarArchivoBackup(): Promise<string | null> {
  let DP: typeof import('expo-document-picker');
  try {
    DP = await import('expo-document-picker');
  } catch {
    throw new BackupError('archivo_no_disponible', 'Funcion no disponible en este dispositivo');
  }
  const res = await DP.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false });
  if (res.canceled || !res.assets?.[0]) return null;
  return res.assets[0].uri;
}

async function leerBytes(fileUri: string): Promise<Uint8Array> {
  const FS = await cargarFileSystem();
  try {
    return await new FS.File(fileUri).bytes();
  } catch (e) {
    console.warn('[Backup] Error leyendo archivo:', e);
    throw new BackupError('archivo_no_disponible', 'No se pudo leer el archivo seleccionado');
  }
}

function contarTablas(): Record<string, number> {
  const db = getDB();
  const out: Record<string, number> = {};
  for (const t of TABLAS_BACKUP) {
    const r = db.getFirstSync<{ n: number }>(`SELECT COUNT(*) AS n FROM ${t}`);
    out[t] = r?.n ?? 0;
  }
  return out;
}

function columnasDestino(tabla: string): Set<string> {
  const filas = getDB().getAllSync<{ name: string }>(`PRAGMA table_info(${tabla})`);
  return new Set(filas.map(f => f.name));
}

function insertarFila(tabla: string, fila: FilaBackup, validas: Set<string>, modo: 'REPLACE' | 'IGNORE'): boolean {
  const cols = Object.keys(fila).filter(c => validas.has(c));
  if (cols.length === 0) return false;
  const res = getDB().runSync(
    `INSERT OR ${modo} INTO ${tabla} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
    cols.map(c => fila[c])
  );
  return (res?.changes ?? 1) > 0;
}

async function recifrarTransacciones(filas: FilaBackup[]): Promise<FilaBackup[]> {
  const out: FilaBackup[] = [];
  for (const f of filas) {
    const desc = typeof f.descripcion === 'string' && f.descripcion !== '' ? await encrypt(f.descripcion) : '';
    const sms = typeof f.sms_raw === 'string' && f.sms_raw !== '' ? await encrypt(f.sms_raw) : null;
    out.push({ ...f, descripcion: desc ?? '', sms_raw: sms });
  }
  return out;
}

function normalizarTransacciones(filas: FilaBackup[]): { filas: FilaBackup[]; normalizadas: number } {
  let normalizadas = 0;
  const out = filas.map(f => {
    const marcado = f.archivado;
    if (marcado !== undefined && marcado !== 0 && marcado !== 1) normalizadas++;
    return { ...f, archivado: normalizarArchivado(marcado) };
  });
  return { filas: out, normalizadas };
}

export async function restaurarPayload(payload: PayloadBackup, modo: ModoRestore): Promise<ResultadoRestore> {
  const db = getDB();
  asegurarTablaMetas();
  const normalizadas = normalizarTransacciones(payload.tables.transacciones);
  const tablas: Record<string, FilaBackup[]> = { ...payload.tables };
  tablas.transacciones = await recifrarTransacciones(normalizadas.filas);
  const antes = contarTablas();
  const insertados: Record<string, number> = {};
  let omitidos = 0;
  let omitidosArchivados = 0;

  try {
    db.withTransactionSync(() => {
      if (modo === 'reemplazar') {
        for (const t of ORDEN_BORRADO) db.runSync(`DELETE FROM ${t}`);
        db.runSync('DELETE FROM reportes_cache');
        for (const t of TABLAS_BACKUP) {
          const validas = columnasDestino(t);
          insertados[t] = 0;
          for (const fila of tablas[t]) {
            if (insertarFila(t, fila, validas, 'REPLACE')) insertados[t]++;
          }
        }
        return;
      }

      const cuentasLocales = new Set(
        db.getAllSync<{ id: string }>('SELECT id FROM cuentas').map(r => r.id)
      );
      const txIds = new Set(db.getAllSync<{ id: string }>('SELECT id FROM transacciones').map(r => r.id));
      const txHashes = new Map<string, 0 | 1>();
      for (const r of db.getAllSync<{ h: string; archivado: number | null }>(
        'SELECT hash_verificacion AS h, archivado AS archivado FROM transacciones WHERE hash_verificacion IS NOT NULL'
      )) {
        txHashes.set(r.h, normalizarArchivado(r.archivado));
      }
      const cuentasNuevas = new Set<string>();
      for (const t of TABLAS_BACKUP) {
        const validas = columnasDestino(t);
        insertados[t] = 0;
        for (const fila of tablas[t]) {
          if (t === 'transacciones') {
            const id = fila.id as string;
            const hash = typeof fila.hash_verificacion === 'string' ? fila.hash_verificacion : null;
            const cuentaId = fila.cuenta_id as string;
            const cuentaExiste = cuentasLocales.has(cuentaId) || cuentasNuevas.has(cuentaId);
            if (txIds.has(id) || !cuentaExiste) {
              omitidos++;
              continue;
            }
            if (hash && txHashes.has(hash)) {
              if (txHashes.get(hash) === 1) omitidosArchivados++;
              else omitidos++;
              continue;
            }
            if (insertarFila(t, fila, validas, 'IGNORE')) {
              insertados[t]++;
              txIds.add(id);
              if (hash) txHashes.set(hash, normalizarArchivado(fila.archivado));
              if (!cuentasNuevas.has(cuentaId)) {
                db.runSync('UPDATE cuentas SET saldo_actual = saldo_actual + ? WHERE id = ?', [
                  fila.monto as number,
                  cuentaId,
                ]);
              }
            } else {
              omitidos++;
            }
            continue;
          }
          if (insertarFila(t, fila, validas, 'IGNORE')) {
            insertados[t]++;
            if (t === 'cuentas') cuentasNuevas.add(fila.id as string);
          } else {
            omitidos++;
          }
        }
      }
      db.runSync('DELETE FROM reportes_cache');
    });
  } catch (e) {
    console.warn('[Backup] Restore revertido:', e);
    throw new BackupError('restore_fallido', 'No se pudo restaurar. Tus datos actuales no fueron modificados');
  }

  return {
    modo, antes, despues: contarTablas(), insertados, omitidos,
    omitidosArchivados, archivadoNormalizado: normalizadas.normalizadas,
  };
}

export async function importarBackup(
  fileUri: string,
  passphrase: string,
  modo: ModoRestore = 'reemplazar'
): Promise<ResultadoRestore> {
  const bytes = await leerBytes(fileUri);
  const payload = await desempaquetarBackup(bytes, passphrase);
  return restaurarPayload(payload, modo);
}

export const CSV_COLUMNAS = [
  'fecha', 'cuenta', 'banco', 'tipo', 'monto', 'categoria', 'descripcion', 'fuente', 'notas', 'archivado',
];

function celdaCSV(valor: unknown, texto: boolean): string {
  let s = valor === null || valor === undefined ? '' : String(valor);
  if (texto && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function generarCSV(
  transacciones: FilaBackup[],
  cuentas: FilaBackup[],
  categorias: FilaBackup[]
): string {
  const alias = new Map(cuentas.map(c => [c.id as string, String(c.alias ?? c.id)]));
  const cats = new Map(categorias.map(c => [c.id as string, String(c.nombre ?? c.id)]));
  const lineas = [CSV_COLUMNAS.join(',')];
  const ordenadas = [...transacciones].sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
  for (const t of ordenadas) {
    lineas.push([
      celdaCSV(t.fecha, false),
      celdaCSV(alias.get(t.cuenta_id as string) ?? t.cuenta_id, true),
      celdaCSV(t.banco_id, true),
      celdaCSV(t.tipo, true),
      celdaCSV(t.monto, false),
      celdaCSV(cats.get(t.categoria_id as string) ?? t.categoria_id, true),
      celdaCSV(t.descripcion, true),
      celdaCSV(t.fuente, true),
      celdaCSV(t.notas, true),
      celdaCSV(normalizarArchivado(t.archivado), false),
    ].join(','));
  }
  return '﻿' + lineas.join('\r\n') + '\r\n';
}

export async function exportarCSV(): Promise<{ uri: string; nombre: string; filas: number }> {
  const { payload } = await construirPayload();
  const csv = generarCSV(payload.tables.transacciones, payload.tables.cuentas, payload.tables.categorias);
  const nombre = `mifinanzaspy-transacciones-${marcaTiempo()}.csv`;
  const uri = await escribirYCompartir(nombre, csv, 'text/csv');
  return { uri, nombre, filas: payload.tables.transacciones.length };
}
