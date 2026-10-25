import {
  ajustesPorCuenta,
  agruparOperaciones,
  deltaSaldoAlBorrar,
  detalleAjustes,
  filtrarArchivo,
  horaDeFila,
  normalizarArchivado,
  ordenarArchivo,
  resolverOperacion,
} from '../services/archivo';
import type { FilaArchivo } from '../services/archivo';
import {
  archivarTransaccion,
  borrarDefinitivoPorId,
  existenHashes,
  getDB,
  getTransaccionPorId,
  getTransacciones,
  getTransaccionesArchivadas,
  insertTransaccion,
  restaurarTodoElArchivo,
  restaurarTransaccion,
  updateTransaccion,
  vaciarArchivo,
} from '../services/database';
import {
  columnasDe,
  fallarEn,
  filasDe,
  insertarFilaFalsa,
  reiniciarSQLiteFalso,
} from './helpers/fakeSqlite';

jest.mock('expo-sqlite', () => {
  const { abrirSQLiteFalso } = require('./helpers/fakeSqlite');
  return { openDatabaseSync: () => abrirSQLiteFalso() };
});

describe('archivo: normalizacion de la marca', () => {
  it('A1: 1 y "1" son archivado', () => {
    expect(normalizarArchivado(1)).toBe(1);
    expect(normalizarArchivado('1')).toBe(1);
  });

  it('A2: 0, 2, null y ausente son visible', () => {
    expect(normalizarArchivado(0)).toBe(0);
    expect(normalizarArchivado('0')).toBe(0);
    expect(normalizarArchivado(2)).toBe(0);
    expect(normalizarArchivado('2')).toBe(0);
    expect(normalizarArchivado(null)).toBe(0);
    expect(normalizarArchivado(undefined)).toBe(0);
  });
});

describe('base: marca de archivado', () => {
  beforeEach(() => {
    reiniciarSQLiteFalso();
  });

  it('B1: el esquema documentado tiene las tres columnas', () => {
    getDB();
    const columnas = getDB().getAllSync<{ name: string }>('PRAGMA table_info(transacciones)').map(c => c.name);
    expect(columnas).toEqual(expect.arrayContaining(['archivado', 'archivado_en', 'archivado_motivo']));
    expect(columnasDe('transacciones')).toEqual(expect.arrayContaining(['archivado', 'archivado_en', 'archivado_motivo']));
  });

  it('B2: una fila insertada queda visible y sin fecha de archivado', async () => {
    insertarFilaFalsa('cuentas', {
      id: 'c1', banco_id: 'itau', alias: 'Itau', saldo_actual: 100000, activa: 1, moneda: 'PYG',
    });
    const guardada = await insertTransaccion({
      cuentaId: 'c1',
      bancoId: 'itau',
      monto: -50000,
      tipo: 'debito',
      categoriaId: 'otros',
      descripcion: 'Compra de prueba',
      fuente: 'manual',
      fecha: '2026-10-20T10:00',
      saldoPost: null,
      smsRaw: null,
      procesado: true,
      notas: null,
      adjunto: null,
    });

    const filas = filasDe('transacciones');
    expect(filas).toHaveLength(1);
    expect(filas[0].id).toBe(guardada.id);
    expect(filas[0].archivado).toBe(0);
    expect(filas[0].archivado_en).toBeNull();
    expect(filas[0].archivado_motivo).toBeNull();
  });
});

function fila(parcial: Partial<FilaArchivo> & { id: string; cuentaId: string; monto: number }): FilaArchivo {
  return {
    bancoId: 'itau',
    fecha: '2026-10-20T10:00',
    descripcion: 'Movimiento',
    esTraspaso: null,
    cuentaParId: null,
    archivado: 1,
    archivadoEn: '2026-10-20T11:00',
    ...parcial,
  };
}

function pata(parcial: { id: string; cuentaId: string; cuentaParId: string; monto: number; fecha?: string }): FilaArchivo {
  return fila({ ...parcial, esTraspaso: 1 });
}

describe('archivo: ajuste de saldo al borrar', () => {
  it('C1: un egreso de 50.000 devuelve un delta de +50.000', () => {
    expect(deltaSaldoAlBorrar(-50000)).toBe(50000);
  });

  it('C2: un ingreso de 50.000 devuelve un delta de -50.000', () => {
    expect(deltaSaldoAlBorrar(50000)).toBe(-50000);
  });

  it('C3: archivar o restaurar no mueve el saldo porque las patas se compensan', () => {
    const pataA = pata({ id: 'a1', cuentaId: 'A', cuentaParId: 'B', monto: -100000 });
    const pataB = pata({ id: 'b1', cuentaId: 'B', cuentaParId: 'A', monto: 100000 });
    const operacion = resolverOperacion(pataA, [pataB]);
    const ids = new Set(operacion.ids);
    const sumaMontos = [pataA, pataB].filter(f => ids.has(f.id)).reduce((s, f) => s + f.monto, 0);
    expect(sumaMontos).toBe(0);
  });

  it('C4: el ajuste del borrado es exactamente el opuesto de lo borrado', () => {
    const pataA = pata({ id: 'a1', cuentaId: 'A', cuentaParId: 'B', monto: -100000 });
    const pataB = pata({ id: 'b1', cuentaId: 'B', cuentaParId: 'A', monto: 100000 });
    const operacion = resolverOperacion(pataA, [pataB]);
    const sumaAjustes = operacion.ajustes.reduce((s, a) => s + a.delta, 0);
    expect(sumaAjustes).toBe(0);
    expect(operacion.ajustes).toEqual([
      { cuentaId: 'A', delta: 100000 },
      { cuentaId: 'B', delta: -100000 },
    ]);
  });
});

describe('archivo: par de traspaso', () => {
  it('D1: un par completo devuelve las dos filas y un ajuste por cuenta', () => {
    const pataA = pata({ id: 'a1', cuentaId: 'A', cuentaParId: 'B', monto: -100000 });
    const pataB = pata({ id: 'b1', cuentaId: 'B', cuentaParId: 'A', monto: 100000 });
    const operacion = resolverOperacion(pataA, [pataB]);
    expect(operacion.ids).toEqual(['a1', 'b1']);
    expect(operacion.traspaso).toBe(true);
    expect(operacion.ambiguo).toBe(false);
    expect(operacion.ajustes).toEqual([
      { cuentaId: 'A', delta: 100000 },
      { cuentaId: 'B', delta: -100000 },
    ]);
  });

  it('D2: sin contraparte la operacion es de una sola fila', () => {
    const pataA = pata({ id: 'a1', cuentaId: 'A', cuentaParId: 'B', monto: -100000 });
    const otraFecha = pata({ id: 'b1', cuentaId: 'B', cuentaParId: 'A', monto: 100000, fecha: '2026-10-19T10:00' });
    const otroMonto = pata({ id: 'b2', cuentaId: 'B', cuentaParId: 'A', monto: 90000 });
    const operacion = resolverOperacion(pataA, [otraFecha, otroMonto]);
    expect(operacion.ids).toEqual(['a1']);
    expect(operacion.traspaso).toBe(false);
    expect(operacion.ambiguo).toBe(false);
    expect(operacion.ajustes).toEqual([{ cuentaId: 'A', delta: 100000 }]);
  });

  it('D3: con mas de una candidata toca solo la fila senalada y marca ambiguo', () => {
    const pataA = pata({ id: 'a1', cuentaId: 'A', cuentaParId: 'B', monto: -100000 });
    const pataB1 = pata({ id: 'b1', cuentaId: 'B', cuentaParId: 'A', monto: 100000 });
    const pataB2 = pata({ id: 'b2', cuentaId: 'B', cuentaParId: 'A', monto: 100000 });
    const operacion = resolverOperacion(pataA, [pataB1, pataB2]);
    expect(operacion.ids).toEqual(['a1']);
    expect(operacion.traspaso).toBe(false);
    expect(operacion.ambiguo).toBe(true);
    expect(operacion.ajustes).toEqual([{ cuentaId: 'A', delta: 100000 }]);
  });

  it('D4: dos patas de la misma cuenta se suman en un solo ajuste', () => {
    const pataA1 = pata({ id: 'a1', cuentaId: 'A', cuentaParId: 'A', monto: -50000 });
    const pataA2 = pata({ id: 'a2', cuentaId: 'A', cuentaParId: 'A', monto: 50000 });
    const operacion = resolverOperacion(pataA1, [pataA2]);
    expect(operacion.ids).toEqual(['a1', 'a2']);
    expect(operacion.ajustes).toEqual([{ cuentaId: 'A', delta: 0 }]);
  });

  it('D5: una fila sin marca de traspaso nunca busca par', () => {
    const suelta = fila({ id: 's1', cuentaId: 'A', monto: -50000 });
    const candidata = pata({ id: 'b1', cuentaId: 'B', cuentaParId: 'A', monto: 50000 });
    const operacion = resolverOperacion(suelta, [candidata]);
    expect(operacion.ids).toEqual(['s1']);
    expect(operacion.traspaso).toBe(false);
    expect(operacion.ambiguo).toBe(false);
  });

  it('D6: resolverOperacion no muta la fila ni las candidatas', () => {
    const pataA = pata({ id: 'a1', cuentaId: 'A', cuentaParId: 'B', monto: -100000 });
    const pataB = pata({ id: 'b1', cuentaId: 'B', cuentaParId: 'A', monto: 100000 });
    const antes = JSON.stringify([pataA, pataB]);
    resolverOperacion(pataA, [pataB]);
    expect(JSON.stringify([pataA, pataB])).toBe(antes);
  });
});

describe('archivo: agrupacion de operaciones', () => {
  const filasVaciado = (): FilaArchivo[] => [
    pata({ id: 'p1a', cuentaId: 'A', cuentaParId: 'B', monto: -200000 }),
    pata({ id: 'p1b', cuentaId: 'B', cuentaParId: 'A', monto: 200000 }),
    pata({ id: 'p2a', cuentaId: 'A', cuentaParId: 'C', monto: -300000 }),
    pata({ id: 'p2b', cuentaId: 'C', cuentaParId: 'A', monto: 300000 }),
    fila({ id: 's1', cuentaId: 'A', monto: -40000 }),
    fila({ id: 's2', cuentaId: 'B', monto: 15000 }),
    fila({ id: 's3', cuentaId: 'C', monto: -25000 }),
  ];

  it('E1: dos pares y tres sueltas se agrupan en cinco operaciones', () => {
    const operaciones = agruparOperaciones(filasVaciado());
    expect(operaciones).toHaveLength(5);
    expect(operaciones.map(o => o.ids)).toEqual([
      ['p1a', 'p1b'],
      ['p2a', 'p2b'],
      ['s1'],
      ['s2'],
      ['s3'],
    ]);
  });

  it('E2: ninguna fila aparece en dos operaciones', () => {
    const filas = filasVaciado();
    const ids = agruparOperaciones(filas).flatMap(o => o.ids);
    expect(ids).toHaveLength(filas.length);
    expect(new Set(ids).size).toBe(filas.length);
  });

  it('E3: el vaciado deja un ajuste por cuenta', () => {
    const ajustes = ajustesPorCuenta(agruparOperaciones(filasVaciado()));
    expect(ajustes).toHaveLength(3);
    expect(ajustes).toEqual([
      { cuentaId: 'A', delta: 540000 },
      { cuentaId: 'B', delta: -215000 },
      { cuentaId: 'C', delta: -275000 },
    ]);
  });

  it('E4: un par ambiguo deja las tres filas en operaciones distintas', () => {
    const pataA = pata({ id: 'a1', cuentaId: 'A', cuentaParId: 'B', monto: -100000 });
    const pataB1 = pata({ id: 'b1', cuentaId: 'B', cuentaParId: 'A', monto: 100000 });
    const pataB2 = pata({ id: 'b2', cuentaId: 'B', cuentaParId: 'A', monto: 100000 });
    const operaciones = agruparOperaciones([pataA, pataB1, pataB2]);
    expect(operaciones).toHaveLength(3);
    expect(operaciones[0].ids).toEqual(['a1']);
    expect(operaciones[0].ambiguo).toBe(true);
    expect(operaciones.flatMap(o => o.ids)).toEqual(['a1', 'b1', 'b2']);
  });

  it('E5: agruparOperaciones no muta la lista de entrada', () => {
    const filas = filasVaciado();
    const antes = JSON.stringify(filas);
    agruparOperaciones(filas);
    expect(JSON.stringify(filas)).toBe(antes);
  });
});

describe('archivo: ajustes por cuenta y detalle', () => {
  it('F1: ajustesPorCuenta suma las filas de la misma cuenta en un solo ajuste', () => {
    const operaciones = [
      { ids: ['x'], traspaso: false, ambiguo: false, ajustes: [{ cuentaId: 'A', delta: 100 }] },
      { ids: ['y'], traspaso: false, ambiguo: false, ajustes: [{ cuentaId: 'A', delta: -30 }] },
      { ids: ['z'], traspaso: false, ambiguo: false, ajustes: [{ cuentaId: 'B', delta: 7 }] },
    ];
    expect(ajustesPorCuenta(operaciones)).toEqual([
      { cuentaId: 'A', delta: 70 },
      { cuentaId: 'B', delta: 7 },
    ]);
    expect(operaciones[0].ajustes).toEqual([{ cuentaId: 'A', delta: 100 }]);
  });

  it('F2: detalleAjustes devuelve alias y estado de cada cuenta en orden', () => {
    const detalle = detalleAjustes(
      [{ cuentaId: 'A', delta: 540000 }, { cuentaId: 'B', delta: -215000 }],
      [{ id: 'A', alias: 'Itau', activa: true }, { id: 'B', alias: 'Ueno', activa: false }]
    );
    expect(detalle).toEqual([
      { cuentaId: 'A', alias: 'Itau', delta: 540000, activa: true },
      { cuentaId: 'B', alias: 'Ueno', delta: -215000, activa: false },
    ]);
  });
});

describe('archivo: orden y hora', () => {
  it('G1: horaDeFila devuelve HH:MM o 00:00 cuando no hay hora', () => {
    expect(horaDeFila('2026-10-20T09:30')).toBe('09:30');
    expect(horaDeFila('2026-10-20T23:05')).toBe('23:05');
    expect(horaDeFila('2026-10-20')).toBe('00:00');
    expect(horaDeFila('2026-10-20T')).toBe('00:00');
  });

  it('G2: ordena por dia y hora descendente con formatos mixtos', () => {
    const filas = [
      fila({ id: 'r1', cuentaId: 'A', monto: -1000, fecha: '2026-10-18' }),
      fila({ id: 'r2', cuentaId: 'A', monto: -2000, fecha: '2026-10-20T09:30' }),
      fila({ id: 'r3', cuentaId: 'A', monto: -3000, fecha: '2026-10-20T18:00' }),
      fila({ id: 'r4', cuentaId: 'A', monto: -4000, fecha: '2026-10-20' }),
      fila({ id: 'r5', cuentaId: 'A', monto: -5000, fecha: '2026-10-19T23:59' }),
    ];
    expect(ordenarArchivo(filas).map(f => f.id)).toEqual(['r3', 'r2', 'r4', 'r5', 'r1']);
  });

  it('G3: desempata por id ascendente y no muta la entrada', () => {
    const filas = [
      fila({ id: 'zz', cuentaId: 'A', monto: -1000, fecha: '2026-10-20T09:30' }),
      fila({ id: 'aa', cuentaId: 'A', monto: -2000, fecha: '2026-10-20T09:30' }),
    ];
    const antes = JSON.stringify(filas);
    const ordenadas = ordenarArchivo(filas);
    expect(ordenadas.map(f => f.id)).toEqual(['aa', 'zz']);
    expect(JSON.stringify(filas)).toBe(antes);
    expect(ordenadas).not.toBe(filas);
  });
});

describe('archivo: filtros', () => {
  const filas = (): FilaArchivo[] => [
    fila({ id: 'f1', cuentaId: 'A', bancoId: 'itau', monto: -1000 }),
    fila({ id: 'f2', cuentaId: 'A', bancoId: 'ueno', monto: -2000 }),
    fila({ id: 'f3', cuentaId: 'B', bancoId: 'itau', monto: -3000 }),
  ];

  it('H1: filtra por cuenta', () => {
    expect(filtrarArchivo(filas(), { cuentaId: 'A' }).map(f => f.id)).toEqual(['f1', 'f2']);
  });

  it('H2: filtra por banco', () => {
    expect(filtrarArchivo(filas(), { bancoId: 'itau' }).map(f => f.id)).toEqual(['f1', 'f3']);
  });

  it('H3: cuenta y banco a la vez es una interseccion', () => {
    expect(filtrarArchivo(filas(), { cuentaId: 'A', bancoId: 'itau' }).map(f => f.id)).toEqual(['f1']);
  });

  it('H4: sin filtros devuelve todas y no muta la entrada', () => {
    const entrada = filas();
    const antes = JSON.stringify(entrada);
    expect(filtrarArchivo(entrada, {})).toHaveLength(3);
    expect(JSON.stringify(entrada)).toBe(antes);
  });
});

function sembrarCuenta(
  id: string,
  saldo: number,
  opciones: { alias?: string; activa?: number } = {}
): void {
  insertarFilaFalsa('cuentas', {
    id,
    banco_id: 'itau',
    banco_nombre: 'Itau',
    app_package: '',
    tipo_cuenta: 'corriente',
    alias: opciones.alias ?? id,
    saldo_actual: saldo,
    moneda: 'PYG',
    activa: opciones.activa ?? 1,
    sms_habilitado: 1,
    notif_habilitada: 1,
    color: '#B36A2A',
    icono: 'bank',
    orden: 0,
    fecha_creacion: '2026-01-01',
  });
}

function sembrarTransaccion(datos: {
  id: string;
  cuentaId: string;
  monto: number;
  fecha?: string;
  esTraspaso?: number;
  cuentaParId?: string | null;
  archivado?: number;
  archivadoEn?: string | null;
  hash?: string | null;
}): void {
  insertarFilaFalsa('transacciones', {
    id: datos.id,
    cuenta_id: datos.cuentaId,
    banco_id: 'itau',
    monto: datos.monto,
    tipo: datos.monto < 0 ? 'debito' : 'credito',
    categoria_id: 'otros',
    descripcion: '',
    fuente: 'manual',
    fecha: datos.fecha ?? '2026-10-20T10:00',
    saldo_post: null,
    sms_raw: null,
    procesado: 1,
    notas: null,
    adjunto: null,
    es_traspaso: datos.esTraspaso ?? 0,
    cuenta_par_id: datos.cuentaParId ?? null,
    hash_verificacion: datos.hash ?? null,
    archivado: datos.archivado ?? 0,
    archivado_en: datos.archivadoEn ?? null,
    archivado_motivo: null,
  });
}

function saldoDe(cuentaId: string): number {
  const cuenta = filasDe('cuentas').find(c => c.id === cuentaId);
  if (!cuenta) throw new Error('Cuenta inexistente: ' + cuentaId);
  return cuenta.saldo_actual as number;
}

function sembrarCache(): void {
  insertarFilaFalsa('reportes_cache', {
    id: 'cache-1',
    tipo: 'mensual',
    fecha: '2026-10',
    contenido_json: '{}',
  });
}

describe('base: lecturas del archivo', () => {
  beforeEach(() => {
    reiniciarSQLiteFalso();
  });

  it('I1: getTransaccionPorId lee por id y devuelve null si no existe', async () => {
    sembrarCuenta('c1', 1000);
    sembrarTransaccion({ id: 't1', cuentaId: 'c1', monto: -50000 });

    const encontrada = await getTransaccionPorId('t1');
    expect(encontrada?.id).toBe('t1');
    expect(encontrada?.monto).toBe(-50000);
    expect(encontrada?.archivado).toBe(0);
    expect(await getTransaccionPorId('no-existe')).toBeNull();
  });

  it('I2: getTransaccionesArchivadas devuelve solo archivadas con alias y estado de la cuenta', async () => {
    sembrarCuenta('c1', 1000, { alias: 'Itau' });
    sembrarCuenta('c2', 1000, { alias: 'Ueno', activa: 0 });
    sembrarTransaccion({ id: 'v1', cuentaId: 'c1', monto: -1000 });
    sembrarTransaccion({
      id: 'a1', cuentaId: 'c1', monto: -2000, fecha: '2026-10-20T09:30',
      archivado: 1, archivadoEn: '2026-10-20T11:00',
    });
    sembrarTransaccion({
      id: 'a2', cuentaId: 'c2', monto: -3000, fecha: '2026-10-20T18:00',
      archivado: 1, archivadoEn: '2026-10-20T19:00',
    });

    const archivadas = await getTransaccionesArchivadas();
    expect(archivadas.map(t => t.id)).toEqual(['a2', 'a1']);
    expect(archivadas[0].cuentaAlias).toBe('Ueno');
    expect(archivadas[0].cuentaActiva).toBe(false);
    expect(archivadas[1].cuentaAlias).toBe('Itau');
    expect(archivadas[1].cuentaActiva).toBe(true);
    expect(archivadas[1].archivadoEn).toBe('2026-10-20T11:00');
  });

  it('I3: getTransaccionesArchivadas filtra por cuenta y banco', async () => {
    sembrarCuenta('c1', 0);
    sembrarCuenta('c2', 0);
    sembrarTransaccion({ id: 'a1', cuentaId: 'c1', monto: -1000, archivado: 1 });
    sembrarTransaccion({ id: 'a2', cuentaId: 'c2', monto: -2000, archivado: 1 });

    const porCuenta = await getTransaccionesArchivadas({ cuentaId: 'c2' });
    expect(porCuenta.map(t => t.id)).toEqual(['a2']);
    const porBanco = await getTransaccionesArchivadas({ bancoId: 'itau' });
    expect(porBanco).toHaveLength(2);
    const otroBanco = await getTransaccionesArchivadas({ bancoId: 'ueno' });
    expect(otroBanco).toHaveLength(0);
  });

  it('I4: getTransacciones no devuelve las archivadas', async () => {
    sembrarCuenta('c1', 0);
    sembrarTransaccion({ id: 'v1', cuentaId: 'c1', monto: -1000, fecha: '2026-10-20T09:30' });
    sembrarTransaccion({ id: 'a1', cuentaId: 'c1', monto: -2000, fecha: '2026-10-20T18:00', archivado: 1 });

    const visibles = await getTransacciones();
    expect(visibles.map(t => t.id)).toEqual(['v1']);
  });

  it('I5: existenHashes distingue visible de archivado y normaliza la marca', () => {
    sembrarCuenta('c1', 0);
    sembrarTransaccion({ id: 'v1', cuentaId: 'c1', monto: -1000, hash: 'h-visible' });
    sembrarTransaccion({ id: 'a1', cuentaId: 'c1', monto: -2000, hash: 'h-archivado', archivado: 1 });
    sembrarTransaccion({ id: 'r1', cuentaId: 'c1', monto: -3000, hash: 'h-raro', archivado: 2 });

    const encontrados = existenHashes(['h-visible', 'h-archivado', 'h-raro', 'h-ausente']);
    expect(encontrados).toHaveLength(3);
    const porHash = new Map(encontrados.map(e => [e.hash, e]));
    expect(porHash.get('h-visible')).toEqual({ hash: 'h-visible', id: 'v1', archivado: 0 });
    expect(porHash.get('h-archivado')).toEqual({ hash: 'h-archivado', id: 'a1', archivado: 1 });
    expect(porHash.get('h-raro')?.archivado).toBe(0);
    expect(existenHashes([])).toEqual([]);
  });

  it('I6: existenHashes consulta en tandas de 400', () => {
    sembrarCuenta('c1', 0);
    sembrarTransaccion({ id: 'ultima', cuentaId: 'c1', monto: -1000, hash: 'h-tanda-401', archivado: 1 });

    const hashes: string[] = [];
    for (let i = 0; i < 400; i++) hashes.push('h-inexistente-' + i);
    hashes.push('h-tanda-401');

    expect(existenHashes(hashes)).toEqual([{ hash: 'h-tanda-401', id: 'ultima', archivado: 1 }]);
  });
});

describe('base: archivar y restaurar', () => {
  beforeEach(() => {
    reiniciarSQLiteFalso();
  });

  it('J1: archivar no borra la fila ni mueve el saldo y escribe la marca con hora local', () => {
    sembrarCuenta('c1', 100000);
    sembrarTransaccion({ id: 't1', cuentaId: 'c1', monto: -50000 });
    sembrarCache();

    const operacion = archivarTransaccion('t1');

    expect(operacion.ids).toEqual(['t1']);
    expect(operacion.traspaso).toBe(false);
    expect(operacion.ambiguo).toBe(false);
    expect(operacion.ajustes).toEqual([]);
    expect(saldoDe('c1')).toBe(100000);
    const filas = filasDe('transacciones');
    expect(filas).toHaveLength(1);
    expect(filas[0].archivado).toBe(1);
    expect(String(filas[0].archivado_en)).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(filas[0].archivado_motivo).toBeNull();
    expect(filasDe('reportes_cache')).toHaveLength(0);
  });

  it('J2: restaurar deja la fila visible, limpia la fecha y no mueve el saldo', () => {
    sembrarCuenta('c1', 100000);
    sembrarTransaccion({
      id: 't1', cuentaId: 'c1', monto: -50000, archivado: 1, archivadoEn: '2026-10-20T11:00',
    });
    sembrarCache();

    const operacion = restaurarTransaccion('t1');

    expect(operacion.ids).toEqual(['t1']);
    expect(operacion.ajustes).toEqual([]);
    expect(saldoDe('c1')).toBe(100000);
    const filas = filasDe('transacciones');
    expect(filas).toHaveLength(1);
    expect(filas[0].archivado).toBe(0);
    expect(filas[0].archivado_en).toBeNull();
    expect(filasDe('reportes_cache')).toHaveLength(0);
  });

  it('J3: archivar un par toca las dos patas y no mueve ninguno de los dos saldos', () => {
    sembrarCuenta('A', 700000);
    sembrarCuenta('B', 300000);
    sembrarTransaccion({
      id: 'a1', cuentaId: 'A', monto: -100000, esTraspaso: 1, cuentaParId: 'B',
    });
    sembrarTransaccion({
      id: 'b1', cuentaId: 'B', monto: 100000, esTraspaso: 1, cuentaParId: 'A',
    });

    const operacion = archivarTransaccion('a1');

    expect(operacion.ids).toEqual(['a1', 'b1']);
    expect(operacion.traspaso).toBe(true);
    expect(operacion.ambiguo).toBe(false);
    expect(operacion.ajustes).toEqual([]);
    expect(saldoDe('A')).toBe(700000);
    expect(saldoDe('B')).toBe(300000);
    const marcas = filasDe('transacciones').map(f => f.archivado);
    expect(marcas).toEqual([1, 1]);
  });

  it('J4: restaurar un par devuelve las dos patas sin mover los saldos', () => {
    sembrarCuenta('A', 700000);
    sembrarCuenta('B', 300000);
    sembrarTransaccion({
      id: 'a1', cuentaId: 'A', monto: -100000, esTraspaso: 1, cuentaParId: 'B',
      archivado: 1, archivadoEn: '2026-10-20T11:00',
    });
    sembrarTransaccion({
      id: 'b1', cuentaId: 'B', monto: 100000, esTraspaso: 1, cuentaParId: 'A',
      archivado: 1, archivadoEn: '2026-10-20T11:00',
    });

    const operacion = restaurarTransaccion('b1');

    expect(operacion.ids).toEqual(['b1', 'a1']);
    expect(operacion.traspaso).toBe(true);
    expect(saldoDe('A')).toBe(700000);
    expect(saldoDe('B')).toBe(300000);
    const filas = filasDe('transacciones');
    expect(filas.map(f => f.archivado)).toEqual([0, 0]);
    expect(filas.map(f => f.archivado_en)).toEqual([null, null]);
  });

  it('J5: con dos candidatas archiva solo la fila señalada y marca ambiguo', () => {
    sembrarCuenta('A', 0);
    sembrarCuenta('B', 0);
    sembrarTransaccion({ id: 'a1', cuentaId: 'A', monto: -100000, esTraspaso: 1, cuentaParId: 'B' });
    sembrarTransaccion({ id: 'b1', cuentaId: 'B', monto: 100000, esTraspaso: 1, cuentaParId: 'A' });
    sembrarTransaccion({ id: 'b2', cuentaId: 'B', monto: 100000, esTraspaso: 1, cuentaParId: 'A' });

    const operacion = archivarTransaccion('a1');

    expect(operacion.ids).toEqual(['a1']);
    expect(operacion.ambiguo).toBe(true);
    expect(filasDe('transacciones').map(f => f.archivado)).toEqual([1, 0, 0]);
  });

  it('J6: restaurarTodoElArchivo devuelve cuantas filas volvieron y no toca saldos', () => {
    sembrarCuenta('A', 500000);
    sembrarCuenta('B', 200000);
    sembrarTransaccion({ id: 'a1', cuentaId: 'A', monto: -100000, archivado: 1, archivadoEn: '2026-10-20T11:00' });
    sembrarTransaccion({ id: 'b1', cuentaId: 'B', monto: 50000, archivado: 1, archivadoEn: '2026-10-20T11:05' });
    sembrarTransaccion({ id: 'v1', cuentaId: 'A', monto: -10000, fecha: '2026-10-19T10:00' });
    sembrarCache();

    expect(restaurarTodoElArchivo()).toBe(2);

    expect(saldoDe('A')).toBe(500000);
    expect(saldoDe('B')).toBe(200000);
    expect(filasDe('transacciones').map(f => f.archivado)).toEqual([0, 0, 0]);
    expect(filasDe('reportes_cache')).toHaveLength(0);
  });
});

describe('base: borrado definitivo', () => {
  beforeEach(() => {
    reiniciarSQLiteFalso();
  });

  it('K1: borrar un egreso de 50.000 suma 50.000 al saldo y borra la fila', () => {
    sembrarCuenta('c1', 50000);
    sembrarTransaccion({ id: 't1', cuentaId: 'c1', monto: -50000, archivado: 1, archivadoEn: '2026-10-20T11:00' });
    sembrarCache();

    const operacion = borrarDefinitivoPorId('t1');

    expect(operacion.ids).toEqual(['t1']);
    expect(operacion.ajustes).toEqual([{ cuentaId: 'c1', delta: 50000 }]);
    expect(saldoDe('c1')).toBe(100000);
    expect(filasDe('transacciones')).toHaveLength(0);
    expect(filasDe('reportes_cache')).toHaveLength(0);
  });

  it('K2: borrar un ingreso descuenta el monto del saldo', () => {
    sembrarCuenta('c1', 80000);
    sembrarTransaccion({ id: 't1', cuentaId: 'c1', monto: 20000, archivado: 1 });

    const operacion = borrarDefinitivoPorId('t1');

    expect(operacion.ajustes).toEqual([{ cuentaId: 'c1', delta: -20000 }]);
    expect(saldoDe('c1')).toBe(60000);
    expect(filasDe('transacciones')).toHaveLength(0);
  });

  it('K3: borrar un par ajusta las dos cuentas y borra las dos filas', () => {
    sembrarCuenta('A', 400000);
    sembrarCuenta('B', 200000);
    sembrarTransaccion({
      id: 'a1', cuentaId: 'A', monto: -100000, esTraspaso: 1, cuentaParId: 'B',
      archivado: 1, archivadoEn: '2026-10-20T11:00',
    });
    sembrarTransaccion({
      id: 'b1', cuentaId: 'B', monto: 100000, esTraspaso: 1, cuentaParId: 'A',
      archivado: 1, archivadoEn: '2026-10-20T11:00',
    });

    const operacion = borrarDefinitivoPorId('a1');

    expect(operacion.ids).toEqual(['a1', 'b1']);
    expect(operacion.ajustes).toEqual([
      { cuentaId: 'A', delta: 100000 },
      { cuentaId: 'B', delta: -100000 },
    ]);
    expect(saldoDe('A')).toBe(500000);
    expect(saldoDe('B')).toBe(100000);
    expect(filasDe('transacciones')).toHaveLength(0);
  });

  it('K4: vaciar el archivo con dos cuentas deja el archivo vacio y los saldos consistentes', () => {
    sembrarCuenta('A', 100000);
    sembrarCuenta('B', 50000);
    sembrarTransaccion({
      id: 'p1a', cuentaId: 'A', monto: -200000, esTraspaso: 1, cuentaParId: 'B',
      archivado: 1, archivadoEn: '2026-10-20T11:00',
    });
    sembrarTransaccion({
      id: 'p1b', cuentaId: 'B', monto: 200000, esTraspaso: 1, cuentaParId: 'A',
      archivado: 1, archivadoEn: '2026-10-20T11:00',
    });
    sembrarTransaccion({ id: 's1', cuentaId: 'A', monto: -40000, archivado: 1 });
    sembrarTransaccion({ id: 's2', cuentaId: 'B', monto: 15000, archivado: 1 });
    sembrarCache();

    const resultado = vaciarArchivo();

    expect(resultado.operaciones).toHaveLength(3);
    expect(resultado.ajustes).toEqual([
      { cuentaId: 'A', delta: 240000 },
      { cuentaId: 'B', delta: -215000 },
    ]);
    expect(saldoDe('A')).toBe(340000);
    expect(saldoDe('B')).toBe(-165000);
    expect(filasDe('transacciones')).toHaveLength(0);
    expect(filasDe('reportes_cache')).toHaveLength(0);
  });

  it('K5: vaciar un archivo vacio no toca las filas visibles', () => {
    sembrarCuenta('c1', 100000);
    sembrarTransaccion({ id: 'v1', cuentaId: 'c1', monto: -30000 });

    const resultado = vaciarArchivo();

    expect(resultado.operaciones).toEqual([]);
    expect(resultado.ajustes).toEqual([]);
    expect(saldoDe('c1')).toBe(100000);
    expect(filasDe('transacciones')).toHaveLength(1);
  });
});

describe('base: atomicidad de las escrituras', () => {
  beforeEach(() => {
    reiniciarSQLiteFalso();
  });

  it('L1: una excepcion al borrar deja la fila y el saldo como estaban', () => {
    sembrarCuenta('c1', 50000);
    sembrarTransaccion({ id: 't1', cuentaId: 'c1', monto: -50000, archivado: 1 });
    fallarEn('DELETE FROM reportes_cache');

    expect(() => borrarDefinitivoPorId('t1')).toThrow(/Fallo inyectado/);
    expect(filasDe('transacciones')).toHaveLength(1);
    expect(saldoDe('c1')).toBe(50000);
  });

  it('L2: una excepcion al vaciar deja filas y saldos como estaban', () => {
    sembrarCuenta('A', 100000);
    sembrarTransaccion({ id: 's1', cuentaId: 'A', monto: -40000, archivado: 1 });
    sembrarTransaccion({ id: 's2', cuentaId: 'A', monto: -10000, archivado: 1 });
    fallarEn('DELETE FROM reportes_cache');

    expect(() => vaciarArchivo()).toThrow(/Fallo inyectado/);
    expect(filasDe('transacciones')).toHaveLength(2);
    expect(saldoDe('A')).toBe(100000);
  });

  it('L3: una excepcion al editar el monto revierte el saldo', async () => {
    sembrarCuenta('c1', 50000);
    sembrarTransaccion({ id: 't1', cuentaId: 'c1', monto: -50000 });
    fallarEn('DELETE FROM reportes_cache');

    await expect(updateTransaccion('t1', { monto: -30000 })).rejects.toThrow(/Fallo inyectado/);
    const fila = filasDe('transacciones').find(f => f.id === 't1');
    expect(fila?.monto).toBe(-50000);
    expect(saldoDe('c1')).toBe(50000);
  });

  it('L4: editar el monto ajusta el saldo por la diferencia e invalida la cache', async () => {
    sembrarCuenta('c1', 50000);
    sembrarTransaccion({ id: 't1', cuentaId: 'c1', monto: -50000 });
    sembrarCache();

    await updateTransaccion('t1', { monto: -30000 });

    expect(saldoDe('c1')).toBe(70000);
    expect(filasDe('reportes_cache')).toHaveLength(0);
    expect((await getTransaccionPorId('t1'))?.monto).toBe(-30000);
  });

  it('L5: editar solo la fecha invalida la cache y no mueve el saldo', async () => {
    sembrarCuenta('c1', 50000);
    sembrarTransaccion({ id: 't1', cuentaId: 'c1', monto: -50000 });
    sembrarCache();

    await updateTransaccion('t1', { fecha: '2026-10-21T08:00' });

    expect(saldoDe('c1')).toBe(50000);
    expect(filasDe('reportes_cache')).toHaveLength(0);
    expect((await getTransaccionPorId('t1'))?.fecha).toBe('2026-10-21T08:00');
  });
});
