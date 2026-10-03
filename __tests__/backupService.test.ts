type Fila = Record<string, string | number | null>;

const COLS: Record<string, string[]> = {
  categorias: ['id', 'nombre', 'icono', 'tinte', 'tipo'],
  cuentas: ['id', 'banco_id', 'alias', 'saldo_actual'],
  categorias_ocultas: ['id'],
  reglas_clasificacion: ['id', 'patron_texto', 'categoria_id'],
  presupuestos: ['id', 'categoria_id', 'monto_limite', 'mes'],
  recordatorios: ['id', 'titulo', 'fecha'],
  metas: ['id', 'titulo', 'meta_monto'],
  transacciones: ['id', 'cuenta_id', 'banco_id', 'monto', 'tipo', 'categoria_id', 'descripcion', 'fecha', 'sms_raw', 'hash_verificacion'],
  configuracion: ['clave', 'valor'],
  reportes_cache: ['id'],
};

const state = {
  tablas: {} as Record<string, Fila[]>,
  fallarEnId: null as string | null,
};

function reset() {
  state.fallarEnId = null;
  for (const t of Object.keys(COLS)) state.tablas[t] = [];
}

function pk(tabla: string): string {
  return tabla === 'configuracion' ? 'clave' : 'id';
}

const fakeDb = {
  getAllSync: (sql: string) => {
    let m = /^SELECT \* FROM (\w+)$/.exec(sql);
    if (m) return state.tablas[m[1]].map(f => ({ ...f }));
    m = /^PRAGMA table_info\((\w+)\)$/.exec(sql);
    if (m) return COLS[m[1]].map(name => ({ name }));
    m = /^SELECT id FROM (\w+)$/.exec(sql);
    if (m) return state.tablas[m[1]].map(f => ({ id: f.id }));
    if (sql.startsWith('SELECT hash_verificacion AS h')) {
      return state.tablas.transacciones
        .filter(f => f.hash_verificacion !== null && f.hash_verificacion !== undefined)
        .map(f => ({ h: f.hash_verificacion }));
    }
    throw new Error('SQL no soportado: ' + sql);
  },
  getFirstSync: (sql: string) => {
    const m = /^SELECT COUNT\(\*\) AS n FROM (\w+)$/.exec(sql);
    if (!m) throw new Error('SQL no soportado: ' + sql);
    return { n: state.tablas[m[1]].length };
  },
  runSync: (sql: string, params: any[] = []) => {
    let m = /^DELETE FROM (\w+)$/.exec(sql);
    if (m) {
      const n = state.tablas[m[1]].length;
      state.tablas[m[1]] = [];
      return { changes: n };
    }
    m = /^INSERT OR (REPLACE|IGNORE) INTO (\w+) \(([^)]*)\) VALUES/.exec(sql);
    if (m) {
      const [, modo, tabla, colsTxt] = m;
      const cols = colsTxt.split(', ');
      const fila: Fila = {};
      cols.forEach((c, i) => { fila[c] = params[i]; });
      if (state.fallarEnId && fila.id === state.fallarEnId) throw new Error('fallo simulado');
      const idx = state.tablas[tabla].findIndex(f => f[pk(tabla)] === fila[pk(tabla)]);
      if (idx >= 0) {
        if (modo === 'IGNORE') return { changes: 0 };
        state.tablas[tabla][idx] = fila;
      } else {
        state.tablas[tabla].push(fila);
      }
      return { changes: 1 };
    }
    if (sql.startsWith('UPDATE cuentas SET saldo_actual = saldo_actual + ?')) {
      const c = state.tablas.cuentas.find(f => f.id === params[1]);
      if (c) c.saldo_actual = (c.saldo_actual as number) + params[0];
      return { changes: c ? 1 : 0 };
    }
    throw new Error('SQL no soportado: ' + sql);
  },
  withTransactionSync: (fn: () => void) => {
    const snap = JSON.parse(JSON.stringify(state.tablas));
    try {
      fn();
    } catch (e) {
      state.tablas = snap;
      throw e;
    }
  },
};

jest.mock('@/services/database', () => ({ getDB: () => fakeDb }));
jest.mock('@/services/metas', () => ({ asegurarTablaMetas: jest.fn() }));

import {
  empaquetarBackup, desempaquetarBackup, derivarClave, construirPayload, restaurarPayload, generarCSV,
  BackupError, BACKUP_SCHEMA_VERSION, type PayloadBackup,
} from '@/services/backupService';
import { encrypt, decrypt } from '@/services/encryption';

const IT = 1000;
const PASS = 'clave-segura-123';

async function sembrar() {
  state.tablas.categorias = [{ id: 'comida', nombre: 'Comida', icono: 'x', tinte: '#000', tipo: 'egreso' }];
  state.tablas.cuentas = [{ id: 'c1', banco_id: 'itau', alias: 'Itau', saldo_actual: 900000 }];
  state.tablas.metas = [{ id: 'm1', titulo: 'Viaje', meta_monto: 5000000 }];
  state.tablas.configuracion = [{ clave: 'nombre', valor: 'Ana' }];
  state.tablas.transacciones = [
    {
      id: 't1', cuenta_id: 'c1', banco_id: 'itau', monto: -100000, tipo: 'egreso',
      categoria_id: 'comida', descripcion: (await encrypt('Almuerzo "Ñandú"'))!,
      fecha: '2026-05-01', sms_raw: (await encrypt('SMS crudo'))!, hash_verificacion: 'h1',
    },
  ];
}

describe('backupService', () => {
  let warn: jest.SpyInstance;
  beforeEach(() => {
    reset();
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => warn.mockRestore());

  it('payload exportado lleva campos sensibles descifrados y se re-cifran al restaurar', async () => {
    await sembrar();
    const { payload } = await construirPayload();
    expect(payload.version).toBe(BACKUP_SCHEMA_VERSION);
    expect(payload.tables.transacciones[0].descripcion).toBe('Almuerzo "Ñandú"');
    expect(payload.tables.transacciones[0].sms_raw).toBe('SMS crudo');

    reset();
    await restaurarPayload(payload, 'reemplazar');
    const guardada = state.tablas.transacciones[0];
    expect(String(guardada.descripcion).startsWith('v2:')).toBe(true);
    await expect(decrypt(guardada.descripcion as string)).resolves.toBe('Almuerzo "Ñandú"');
  });

  it('roundtrip cifrado completo: archivo no contiene texto plano', async () => {
    await sembrar();
    const { payload } = await construirPayload();
    const bytes = await empaquetarBackup(payload, PASS, { iteraciones: IT });
    expect(Buffer.from(bytes).toString('latin1')).not.toContain('Almuerzo');
    const leido = await desempaquetarBackup(bytes, PASS);
    expect(leido).toEqual(payload);
  });

  it('KDF coincide con PBKDF2-HMAC-SHA512 de referencia', async () => {
    const nodeCrypto = require('crypto');
    const salt = new Uint8Array(16).map((_, i) => i * 7);
    const mia = await derivarClave('contraseña ñ 123', salt, 2500);
    const ref = nodeCrypto.pbkdf2Sync('contraseña ñ 123'.normalize('NFKC'), Buffer.from(salt), 2500, 32, 'sha512');
    expect(Buffer.from(mia).equals(ref)).toBe(true);
  });

  it('salt y nonce aleatorios: dos exports del mismo payload difieren', async () => {
    await sembrar();
    const { payload } = await construirPayload();
    const a = await empaquetarBackup(payload, PASS, { iteraciones: IT });
    const b = await empaquetarBackup(payload, PASS, { iteraciones: IT });
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false);
  });

  it('passphrase menor al minimo se rechaza', async () => {
    const p: PayloadBackup = { version: 1, createdAt: 'x', tables: {} };
    await expect(empaquetarBackup(p, 'corta', { iteraciones: IT })).rejects.toMatchObject({ codigo: 'passphrase_corta' });
  });

  it('passphrase incorrecta falla limpio y no toca los datos', async () => {
    await sembrar();
    const { payload } = await construirPayload();
    const bytes = await empaquetarBackup(payload, PASS, { iteraciones: IT });
    const antes = JSON.stringify(state.tablas);
    await expect(desempaquetarBackup(bytes, 'otra-clave-999')).rejects.toMatchObject({ codigo: 'passphrase_incorrecta' });
    expect(JSON.stringify(state.tablas)).toBe(antes);
  });

  it('archivo alterado es detectado', async () => {
    await sembrar();
    const { payload } = await construirPayload();
    const bytes = await empaquetarBackup(payload, PASS, { iteraciones: IT });
    const cuerpo = Uint8Array.from(bytes);
    cuerpo[cuerpo.length - 5] ^= 0x01;
    await expect(desempaquetarBackup(cuerpo, PASS)).rejects.toMatchObject({ codigo: 'passphrase_incorrecta' });
    const cabecera = Uint8Array.from(bytes);
    cabecera[30] ^= 0xff;
    await expect(desempaquetarBackup(cabecera, PASS)).rejects.toBeInstanceOf(BackupError);
    const magic = Uint8Array.from(bytes);
    magic[0] = 0;
    await expect(desempaquetarBackup(magic, PASS)).rejects.toMatchObject({ codigo: 'formato_invalido' });
    await expect(desempaquetarBackup(new Uint8Array(10), PASS)).rejects.toMatchObject({ codigo: 'formato_invalido' });
  });

  it('version de esquema distinta se rechaza', async () => {
    const tablas = Object.fromEntries(Object.keys(COLS).map(t => [t, []]));
    const futuro: PayloadBackup = { version: 99, createdAt: 'x', tables: tablas };
    const bytes = await empaquetarBackup(futuro, PASS, { iteraciones: IT });
    await expect(desempaquetarBackup(bytes, PASS)).rejects.toMatchObject({ codigo: 'version_no_soportada' });
  });

  it('version de formato de archivo distinta se rechaza', async () => {
    const tablas = Object.fromEntries(Object.keys(COLS).map(t => [t, []]));
    const bytes = Uint8Array.from(await empaquetarBackup({ version: 1, createdAt: 'x', tables: tablas }, PASS, { iteraciones: IT }));
    bytes[6] = 7;
    await expect(desempaquetarBackup(bytes, PASS)).rejects.toMatchObject({ codigo: 'version_no_soportada' });
  });

  it('esquema invalido: transaccion con cuenta inexistente o monto decimal', async () => {
    const base = { version: 1, createdAt: 'x' };
    const tx = { id: 't', cuenta_id: 'zz', monto: 5 };
    const p1 = { ...base, tables: { cuentas: [], transacciones: [tx] } } as unknown as PayloadBackup;
    await expect(desempaquetarBackup(await empaquetarBackup(p1, PASS, { iteraciones: IT }), PASS))
      .rejects.toMatchObject({ codigo: 'esquema_invalido' });
    const p2 = { ...base, tables: { cuentas: [{ id: 'zz' }], transacciones: [{ ...tx, monto: 5.5 }] } } as unknown as PayloadBackup;
    await expect(desempaquetarBackup(await empaquetarBackup(p2, PASS, { iteraciones: IT }), PASS))
      .rejects.toMatchObject({ codigo: 'esquema_invalido' });
  });

  it('reemplazar: deja exactamente el contenido del backup y reporta conteos', async () => {
    await sembrar();
    const { payload } = await construirPayload();
    state.tablas.cuentas.push({ id: 'c2', banco_id: 'x', alias: 'Otra', saldo_actual: 1 });
    state.tablas.configuracion.push({ clave: 'extra', valor: '1' });
    const r = await restaurarPayload(payload, 'reemplazar');
    expect(r.antes.cuentas).toBe(2);
    expect(r.despues.cuentas).toBe(1);
    expect(state.tablas.configuracion).toHaveLength(1);
    expect(state.tablas.transacciones).toHaveLength(1);
  });

  it('restore con fallo revierte todo (rollback)', async () => {
    await sembrar();
    const { payload } = await construirPayload();
    state.tablas.cuentas.push({ id: 'c2', banco_id: 'x', alias: 'Otra', saldo_actual: 1 });
    const antes = JSON.stringify(state.tablas);
    state.fallarEnId = 't1';
    await expect(restaurarPayload(payload, 'reemplazar')).rejects.toMatchObject({ codigo: 'restore_fallido' });
    expect(JSON.stringify(state.tablas)).toBe(antes);
  });

  it('combinar: dedup por id y por hash, ajusta saldo solo de cuentas existentes', async () => {
    await sembrar();
    const { payload } = await construirPayload();
    payload.tables.transacciones.push(
      { id: 't2', cuenta_id: 'c1', banco_id: 'itau', monto: -50000, tipo: 'egreso', categoria_id: 'comida', descripcion: 'Cena', fecha: '2026-05-02', sms_raw: null, hash_verificacion: 'h2' },
      { id: 't3', cuenta_id: 'c1', banco_id: 'itau', monto: -50000, tipo: 'egreso', categoria_id: 'comida', descripcion: 'Cena', fecha: '2026-05-02', sms_raw: null, hash_verificacion: 'h2' },
      { id: 't4', cuenta_id: 'c1', banco_id: 'itau', monto: -7, tipo: 'egreso', categoria_id: 'comida', descripcion: 'Mismo hash local', fecha: '2026-05-01', sms_raw: null, hash_verificacion: 'h1' },
    );
    payload.tables.cuentas.push({ id: 'c9', banco_id: 'y', alias: 'Nueva', saldo_actual: 777 });
    payload.tables.transacciones.push(
      { id: 't9', cuenta_id: 'c9', banco_id: 'y', monto: 777, tipo: 'ingreso', categoria_id: 'comida', descripcion: 'Sueldo', fecha: '2026-05-03', sms_raw: null, hash_verificacion: 'h9' },
    );
    state.tablas.configuracion = [{ clave: 'nombre', valor: 'Local' }];

    const r = await restaurarPayload(payload, 'combinar');
    expect(r.insertados.transacciones).toBe(2);
    expect(r.omitidos).toBe(7);
    expect(state.tablas.transacciones.map(t => t.id).sort()).toEqual(['t1', 't2', 't9']);
    expect(state.tablas.cuentas.find(c => c.id === 'c1')!.saldo_actual).toBe(850000);
    expect(state.tablas.cuentas.find(c => c.id === 'c9')!.saldo_actual).toBe(777);
    expect(state.tablas.configuracion[0].valor).toBe('Local');
  });

  it('CSV: escapa comillas/comas, neutraliza formulas y usa descripcion descifrada', () => {
    const csv = generarCSV(
      [
        { id: 'a', cuenta_id: 'c1', banco_id: 'itau', monto: -1500, tipo: 'egreso', categoria_id: 'comida', descripcion: '=HYPERLINK("x"), "hola"', fecha: '2026-05-01', fuente: 'manual', notas: null },
      ],
      [{ id: 'c1', alias: 'Mi Itau' }],
      [{ id: 'comida', nombre: 'Comida' }]
    );
    const lineas = csv.replace('﻿', '').trim().split('\r\n');
    expect(lineas[0]).toBe('fecha,cuenta,banco,tipo,monto,categoria,descripcion,fuente,notas');
    expect(lineas[1]).toBe('2026-05-01,Mi Itau,itau,egreso,-1500,Comida,"\'=HYPERLINK(""x""), ""hola""",manual,');
  });
});
