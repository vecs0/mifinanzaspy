import {
  agregarConstancia,
  calcularTotales,
  clasificarDuplicados,
  compararCantidad,
  compararSaldos,
  construirVerificacion,
  detectarAnomalias,
  limpiarFechaAsumida,
  marcarFechasAsumidas,
  rangoFechas,
  selloVerificacion,
  textoConstancia,
} from '../services/verificacion';
import type {
  ExistenteHash,
  Fusion,
  ItemVerificacion,
  MetadatosDeclarados,
} from '../services/verificacion';
import { localDateKey } from '../services/dateKeys';

const HOY = localDateKey(new Date(2026, 9, 20));

function item(parte: Partial<ItemVerificacion> & { id: string }): ItemVerificacion {
  return {
    monto: -1000,
    fecha: '2026-10-15T12:00',
    descripcion: 'Movimiento de prueba',
    ...parte,
  };
}

describe('comparacion de cantidad', () => {
  it('con la cantidad declarada coincidente la diferencia es cero', () => {
    const r = compararCantidad(42, 42);
    expect(r).toEqual({ declarada: 42, leida: 42, diferencia: 0, hayDatoDeclarado: true });
  });

  it('faltan movimientos: la diferencia es negativa', () => {
    const r = compararCantidad(42, 40);
    expect(r.diferencia).toBe(-2);
    expect(r.hayDatoDeclarado).toBe(true);
  });

  it('sobran movimientos: la diferencia es positiva', () => {
    const r = compararCantidad(40, 42);
    expect(r.diferencia).toBe(2);
  });

  it('sin dato declarado: declarada y diferencia son null', () => {
    const r = compararCantidad(undefined, 40);
    expect(r).toEqual({ declarada: null, leida: 40, diferencia: null, hayDatoDeclarado: false });
  });

  it('lote: la cantidad declarada es la suma de los archivos que declaran', () => {
    const metadatos: MetadatosDeclarados = {
      archivos: [
        { nombre: 'a.pdf', cantidadDeclarada: 10 },
        { nombre: 'b.pdf', cantidadDeclarada: 5 },
        { nombre: 'c.csv' },
        { nombre: 'd.pdf', cantidadDeclarada: 7 },
      ],
    };
    const items = Array.from({ length: 22 }, (_, i) => item({ id: `i${i}` }));
    const r = construirVerificacion({
      items,
      leidas: 22,
      fusiones: [],
      metadatos,
      existentes: [],
      hoy: HOY,
      origen: 'lote',
    });
    expect(r.cantidad).toEqual({ declarada: 22, leida: 22, diferencia: 0, hayDatoDeclarado: true });
  });
});

describe('comparacion de saldos', () => {
  it('cuando coinciden la diferencia es cero y es evaluable', () => {
    const r = compararSaldos(1_000_000, 1_500_000, [{ monto: 500_000 }]);
    expect(r).toEqual({
      inicial: 1_000_000,
      calculado: 1_500_000,
      final: 1_500_000,
      diferencia: 0,
      evaluable: true,
    });
  });

  it('cuando difieren la diferencia es final - calculado con signo', () => {
    const r = compararSaldos(1_000_000, 1_500_000, [{ monto: 400_000 }, { monto: 50_000 }]);
    expect(r.calculado).toBe(1_450_000);
    expect(r.diferencia).toBe(50_000);
  });

  it('sin saldo inicial declarado no es evaluable', () => {
    const r = compararSaldos(undefined, 1_500_000, [{ monto: 500_000 }]);
    expect(r.evaluable).toBe(false);
    expect(r.diferencia).toBe(null);
    expect(r.final).toBe(1_500_000);
  });

  it('sin saldo final declarado no es evaluable', () => {
    const r = compararSaldos(1_000_000, undefined, [{ monto: 500_000 }]);
    expect(r.evaluable).toBe(false);
    expect(r.diferencia).toBe(null);
    expect(r.inicial).toBe(1_000_000);
  });

  it('una diferencia negativa conserva el signo en guaranies enteros', () => {
    const r = compararSaldos(1_000_000, 1_000_000, [{ monto: 50_000 }]);
    expect(r.calculado).toBe(1_050_000);
    expect(r.diferencia).toBe(-50_000);
  });
});

describe('totales y rango de fechas', () => {
  it('calcularTotales suma ingresos, egresos y neto con fechas legibles', () => {
    const r = calcularTotales(
      [
        { monto: 200_000, fecha: '2026-10-05T09:00' },
        { monto: -50_000, fecha: '2026-10-06T23:59' },
        { monto: -10_000, fecha: '2026-10-31T22:00' },
      ],
      'Itau'
    );
    expect(r.ingresos).toBe(200_000);
    expect(r.egresos).toBe(60_000);
    expect(r.neto).toBe(140_000);
    expect(r.desde).toBe('05/10/2026');
    expect(r.hasta).toBe('31/10/2026');
    expect(r.banco).toBe('Itau');
  });

  it('rangoFechas no corre de dia con formato AAAA-MM-DDTHH:MM ni con el ultimo dia del mes', () => {
    const r = rangoFechas([
      { fecha: '2026-09-30T23:59' },
      { fecha: '2026-10-01' },
      { fecha: '2026-10-31T22:10' },
    ]);
    expect(r).toEqual({ desde: '30/09/2026', hasta: '31/10/2026' });
  });

  it('rangoFechas devuelve null sin fechas', () => {
    expect(rangoFechas([])).toBe(null);
  });
});

describe('duplicados contra la base', () => {
  const existentes: ExistenteHash[] = [
    { hash: 'h1', id: 'db1', archivado: 0 },
    { hash: 'h2', id: 'db2', archivado: 1 },
  ];

  it('una nueva se clasifica como nueva', () => {
    const r = clasificarDuplicados([item({ id: 'i1', hash: 'h3' })], existentes);
    expect(r.nuevas).toHaveLength(1);
    expect(r.yaCargadas).toHaveLength(0);
    expect(r.yaCargadasArchivadas).toHaveLength(0);
  });

  it('un hash visible se clasifica como ya cargada', () => {
    const r = clasificarDuplicados([item({ id: 'i1', hash: 'h1' })], existentes);
    expect(r.yaCargadas.map(i => i.id)).toEqual(['i1']);
    expect(r.nuevas).toHaveLength(0);
  });

  it('un hash archivado se clasifica como ya cargada y archivada', () => {
    const r = clasificarDuplicados([item({ id: 'i1', hash: 'h2' })], existentes);
    expect(r.yaCargadasArchivadas.map(i => i.id)).toEqual(['i1']);
    expect(r.yaCargadas).toHaveLength(0);
  });

  it('sin hash se clasifica como nueva', () => {
    const r = clasificarDuplicados([item({ id: 'i1' })], existentes);
    expect(r.nuevas).toHaveLength(1);
  });
});

describe('anomalias con accion', () => {
  const base = {
    items: [] as ItemVerificacion[],
    leidas: 2,
    fusiones: [] as Fusion[],
    cantidad: compararCantidad(2, 2),
    saldos: compararSaldos(undefined, undefined, []),
    duplicadosArchivo: [] as string[],
    hoy: HOY,
  };

  it('duplicado dentro del archivo lleva accion quitar', () => {
    const r = detectarAnomalias({
      ...base,
      items: [item({ id: 'i1' }), item({ id: 'i2' })],
      duplicadosArchivo: ['i2'],
    });
    const a = r.find(x => x.tipo === 'duplicado_archivo');
    expect(a).toBeDefined();
    expect(a!.accion).toBe('quitar');
    expect(a!.refs).toEqual(['i2']);
  });

  it('montos partidos sin fusionar llevan accion fusionar con las dos filas', () => {
    const r = detectarAnomalias({
      ...base,
      items: [
        item({ id: 'i1', monto: -100_000, fecha: '2026-10-15T09:00' }),
        item({ id: 'i2', monto: -500_000, fecha: '2026-10-15T10:00' }),
      ],
    });
    const a = r.find(x => x.tipo === 'montos_partidos');
    expect(a).toBeDefined();
    expect(a!.accion).toBe('fusionar');
    expect(a!.refs).toEqual(['i1', 'i2']);
  });

  it('monto minimo lleva accion editar_monto', () => {
    const r = detectarAnomalias({ ...base, items: [item({ id: 'i1', monto: 5 })] });
    const a = r.find(x => x.tipo === 'monto_minimo');
    expect(a).toBeDefined();
    expect(a!.accion).toBe('editar_monto');
  });

  it('fecha futura lleva accion editar_fecha', () => {
    const r = detectarAnomalias({ ...base, items: [item({ id: 'i1', fecha: '2026-12-01T10:00' })] });
    const a = r.find(x => x.tipo === 'fecha_futura');
    expect(a).toBeDefined();
    expect(a!.accion).toBe('editar_fecha');
  });

  it('fecha asumida lleva accion editar_fecha', () => {
    const r = detectarAnomalias({
      ...base,
      items: [item({ id: 'i1', fechaAsumida: true })],
    });
    const a = r.find(x => x.tipo === 'fecha_asumida');
    expect(a).toBeDefined();
    expect(a!.accion).toBe('editar_fecha');
    expect(a!.refs).toEqual(['i1']);
  });

  it('diferencia de cantidad faltando lleva accion agregar_movimiento', () => {
    const r = detectarAnomalias({
      ...base,
      cantidad: compararCantidad(5, 3),
    });
    const a = r.find(x => x.tipo === 'diferencia_cantidad');
    expect(a).toBeDefined();
    expect(a!.accion).toBe('agregar_movimiento');
    expect(a!.mensaje).toContain('2');
  });

  it('diferencia de cantidad sobrando lleva accion quitar', () => {
    const r = detectarAnomalias({
      ...base,
      cantidad: compararCantidad(3, 5),
    });
    const a = r.find(x => x.tipo === 'diferencia_cantidad');
    expect(a!.accion).toBe('quitar');
  });

  it('diferencia de saldo faltando lleva accion agregar_movimiento', () => {
    const r = detectarAnomalias({
      ...base,
      saldos: compararSaldos(1_000_000, 1_500_000, [{ monto: 450_000 }]),
    });
    const a = r.find(x => x.tipo === 'diferencia_saldo');
    expect(a).toBeDefined();
    expect(a!.accion).toBe('agregar_movimiento');
    expect(a!.mensaje).toContain('50.000');
  });

  it('diferencia de saldo sobrando lleva accion editar_monto', () => {
    const r = detectarAnomalias({
      ...base,
      saldos: compararSaldos(1_000_000, 1_500_000, [{ monto: 600_000 }]),
    });
    const a = r.find(x => x.tipo === 'diferencia_saldo');
    expect(a!.accion).toBe('editar_monto');
  });

  it('sin datos declarados no hay anomalia de cantidad ni de saldo', () => {
    const r = detectarAnomalias({ ...base, items: [item({ id: 'i1' })] });
    expect(r.find(x => x.tipo === 'diferencia_cantidad')).toBeUndefined();
    expect(r.find(x => x.tipo === 'diferencia_saldo')).toBeUndefined();
  });

  it('una fila ya fusionada no se vuelve a ofrecer para fusionar', () => {
    const fusionada = item({ id: 'f1', monto: -600_000 });
    const r = detectarAnomalias({
      ...base,
      items: [fusionada, item({ id: 'i3', monto: -1_000 })],
      fusiones: [
        {
          fusionada,
          originales: [
            item({ id: 'o1', monto: -100_000 }),
            item({ id: 'o2', monto: -500_000 }),
          ],
        },
      ],
    });
    expect(r.find(x => x.tipo === 'montos_partidos')).toBeUndefined();
  });

  it('los siete tipos de anomalia aparecen juntos con su accion', () => {
    const items = [
      item({ id: 'i1', monto: -5_500 }),
      item({ id: 'i2', monto: -7_500 }),
      item({ id: 'i3', monto: -5 }),
      item({ id: 'i4', monto: -3_200, fecha: '2026-11-05T10:00' }),
      item({ id: 'i5', monto: -4_300, fecha: '2026-10-03T10:00', fechaAsumida: true }),
      item({ id: 'i6', monto: -100_000, fecha: '2026-10-04T10:00' }),
      item({ id: 'i7', monto: -500_000, fecha: '2026-10-04T11:00' }),
    ];
    const r = detectarAnomalias({
      items,
      leidas: 7,
      fusiones: [],
      cantidad: compararCantidad(9, 7),
      saldos: compararSaldos(1_000_000, 900_000, items),
      duplicadosArchivo: ['i2'],
      hoy: HOY,
    });
    const acciones = new Map(r.map(a => [a.tipo, a.accion]));
    expect(acciones.get('duplicado_archivo')).toBe('quitar');
    expect(acciones.get('montos_partidos')).toBe('fusionar');
    expect(acciones.get('monto_minimo')).toBe('editar_monto');
    expect(acciones.get('fecha_futura')).toBe('editar_fecha');
    expect(acciones.get('fecha_asumida')).toBe('editar_fecha');
    expect(acciones.get('diferencia_cantidad')).toBe('agregar_movimiento');
    expect(acciones.get('diferencia_saldo')).toBe('agregar_movimiento');
  });
});

describe('estado de la verificacion', () => {
  const items = [
    item({ id: 'i1', monto: -1_500, descripcion: 'Fila A' }),
    item({ id: 'i2', monto: 2_500, descripcion: 'Fila B' }),
  ];

  function verificar(parte: {
    items?: ItemVerificacion[];
    leidas?: number;
    fusiones?: Fusion[];
    metadatos?: MetadatosDeclarados;
    existentes?: ExistenteHash[];
    duplicadosArchivo?: string[];
  }) {
    return construirVerificacion({
      items,
      leidas: 2,
      fusiones: [],
      metadatos: {},
      existentes: [],
      hoy: HOY,
      origen: 'pdf',
      ...parte,
    });
  }

  it('todo cuadra: estado guardar y explicito', () => {
    const r = verificar({ metadatos: { cantidadDeclarada: 2 } });
    expect(r.estado).toBe('guardar');
    expect(r.anomalias).toEqual([]);
    expect(r.totales.banco).toBe(null);
  });

  it('diferencia de cantidad: estado guardar_con_observacion', () => {
    const r = verificar({ metadatos: { cantidadDeclarada: 5 }, leidas: 2 });
    expect(r.estado).toBe('guardar_con_observacion');
  });

  it('diferencia de saldo: estado guardar_con_observacion', () => {
    const r = verificar({
      metadatos: {
        cantidadDeclarada: 2,
        saldoInicial: 1_000_000,
        saldoFinal: 1_500_000,
      },
    });
    expect(r.estado).toBe('guardar_con_observacion');
    expect(r.saldos.diferencia).toBe(499_000);
  });

  it('duplicados dentro del archivo: estado guardar_con_observacion', () => {
    const r = verificar({
      items: [
        item({ id: 'i1', monto: -125_500 }),
        item({ id: 'i2', monto: -125_500 }),
      ],
    });
    expect(r.estado).toBe('guardar_con_observacion');
  });

  it('duplicados contra la base: estado guardar_con_observacion', () => {
    const r = verificar({
      items: [item({ id: 'i1', hash: 'h' }), item({ id: 'i2' })],
      existentes: [{ hash: 'h', id: 'db1', archivado: 0 }],
    });
    expect(r.estado).toBe('guardar_con_observacion');
  });

  it('nunca existe un estado de error', () => {
    const casos = [
      verificar({}),
      verificar({ metadatos: { cantidadDeclarada: 9, saldoInicial: 0, saldoFinal: 9 } }),
      verificar({
        items: [item({ id: 'i1', monto: -125_500 }), item({ id: 'i2', monto: -125_500 })],
      }),
    ];
    for (const caso of casos) {
      expect(['guardar', 'guardar_con_observacion']).toContain(caso.estado);
    }
  });
});

describe('cantidad leida antes de fusionar', () => {
  it('se usa leidas, no items.length, aunque haya dos pares fusionados', () => {
    const fusionada: ItemVerificacion = item({
      id: 'f1',
      monto: -600_000,
      fecha: '2026-10-15T12:00',
    });
    const fusiones: Fusion[] = [
      {
        fusionada,
        originales: [
          item({ id: 'o1', monto: -100_000, fecha: '2026-10-15T09:00' }),
          item({ id: 'o2', monto: -500_000, fecha: '2026-10-15T10:00' }),
        ],
      },
      {
        fusionada: item({ id: 'f2', monto: 700_000, fecha: '2026-10-17T09:00' }),
        originales: [
          item({ id: 'o3', monto: 200_000, fecha: '2026-10-17T08:00' }),
          item({ id: 'o4', monto: 500_000, fecha: '2026-10-17T08:30' }),
        ],
      },
    ];
    const r = construirVerificacion({
      items: [
        fusionada,
        item({ id: 'i3', monto: -2_000, fecha: '2026-10-16T09:00' }),
        item({ id: 'i4', monto: 700_000, fecha: '2026-10-17T09:00' }),
      ],
      leidas: 5,
      fusiones,
      metadatos: { cantidadDeclarada: 5 },
      existentes: [],
      hoy: HOY,
      origen: 'pdf',
    });
    expect(r.cantidad.leida).toBe(5);
    expect(r.cantidad.diferencia).toBe(0);
    expect(r.fusiones).toHaveLength(2);
    expect(r.estado).toBe('guardar');
  });
});

describe('fechas asumidas', () => {
  it('un movimiento sin fecha recibe la clave del dia local y queda marcado', () => {
    const r = marcarFechasAsumidas([item({ id: 'i1', fecha: '' })], HOY);
    expect(r[0].fecha).toBe('2026-10-20');
    expect(r[0].fechaAsumida).toBe(true);
  });

  it('un movimiento con fecha no se toca y no muta la entrada', () => {
    const original = [item({ id: 'i1' })];
    const copia = JSON.parse(JSON.stringify(original));
    const r = marcarFechasAsumidas(original, HOY);
    expect(JSON.stringify(original)).toBe(JSON.stringify(copia));
    expect(r[0].fechaAsumida).toBeUndefined();
  });

  it('limpiarFechaAsumida borra la marca y conserva la fecha', () => {
    const original = item({ id: 'i1', fechaAsumida: true });
    const r = limpiarFechaAsumida(original);
    expect(r.fechaAsumida).toBeUndefined();
    expect(r.fecha).toBe('2026-10-15T12:00');
    expect(r.id).toBe('i1');
    expect(r).not.toBe(original);
    expect(original.fechaAsumida).toBe(true);
  });

  it('sin sello explicito usa la clave de dia local de hoy', () => {
    const r = marcarFechasAsumidas([item({ id: 'i1', fecha: '' })]);
    expect(r[0].fecha).toBe(localDateKey());
    expect(r[0].fechaAsumida).toBe(true);
  });

  it('la fecha por defecto es la clave de dia local de hoy', () => {
    expect(HOY).toBe('2026-10-20');
  });
});

describe('constancia', () => {
  function resultadoConDiferencias() {
    return construirVerificacion({
      items: [item({ id: 'i1', monto: 400_000 }), item({ id: 'i2', monto: 50_000 })],
      leidas: 2,
      fusiones: [],
      metadatos: { cantidadDeclarada: 5, saldoInicial: 1_000_000, saldoFinal: 1_500_000 },
      existentes: [],
      hoy: HOY,
      origen: 'pdf',
    });
  }

  it('el texto usa el formato fijo con el sello inyectado', () => {
    const r = resultadoConDiferencias();
    const texto = textoConstancia(r, '2026-10-20T14:35');
    expect(texto).toBe(
      '[Verificación 2026-10-20 14:35] declaradas 5 · leídas 2 · saldo declarado Gs. 1.500.000 · calculado Gs. 1.450.000 · diferencia Gs. 50.000'
    );
  });

  it('cuando todo cuadra no se escribe constancia', () => {
    const r = construirVerificacion({
      items: [
        item({ id: 'i1', monto: -1_500, descripcion: 'Fila A' }),
        item({ id: 'i2', monto: 2_500, descripcion: 'Fila B' }),
      ],
      leidas: 2,
      fusiones: [],
      metadatos: { cantidadDeclarada: 2 },
      existentes: [],
      hoy: HOY,
      origen: 'pdf',
    });
    expect(r.estado).toBe('guardar');
    expect(textoConstancia(r, '2026-10-20T14:35')).toBe(null);
  });

  it('con saldos no declarados el texto lo dice', () => {
    const r = construirVerificacion({
      items: [item({ id: 'i1' }), item({ id: 'i2' })],
      leidas: 2,
      fusiones: [],
      metadatos: { cantidadDeclarada: 5 },
      existentes: [],
      hoy: HOY,
      origen: 'pdf',
    });
    const texto = textoConstancia(r, '2026-10-20T14:35');
    expect(texto).toBe('[Verificación 2026-10-20 14:35] declaradas 5 · leídas 2 · saldos no declarados');
  });

  it('agregarConstancia conserva la nota previa en una linea nueva', () => {
    const texto = 'constancia de prueba';
    expect(agregarConstancia(null, texto)).toBe(texto);
    expect(agregarConstancia('Nota del usuario', texto)).toBe(`Nota del usuario\n${texto}`);
  });

  it('dos guardados con observacion conservan las dos constancias', () => {
    const texto = '[Verificación 2026-10-20 14:35] declaradas 5 · leídas 2 · saldos no declarados';
    const una = agregarConstancia('Nota del usuario', texto);
    const dos = agregarConstancia(una, texto);
    expect(dos).toBe(`Nota del usuario\n${texto}\n${texto}`);
    expect(dos.startsWith('Nota del usuario')).toBe(true);
  });

  it('la constancia es identica para todas las filas de la carga', () => {
    const primera = textoConstancia(resultadoConDiferencias(), '2026-10-20T14:35');
    const segunda = textoConstancia(resultadoConDiferencias(), '2026-10-20T14:35');
    expect(segunda).toBe(primera);
    expect(segunda).not.toBe(null);
  });

  it('selloVerificacion usa la clave local de fecha y hora', () => {
    expect(selloVerificacion(new Date(2026, 9, 20, 14, 35))).toBe('2026-10-20T14:35');
    expect(selloVerificacion(new Date(2026, 9, 31, 23, 5))).toBe('2026-10-31T23:05');
  });
});

describe('csv', () => {
  it('no compara saldos aunque la metadata los traiga', () => {
    const r = construirVerificacion({
      items: [item({ id: 'i1' })],
      leidas: 1,
      fusiones: [],
      metadatos: { cantidadDeclarada: 1, saldoInicial: 0, saldoFinal: 1_000 },
      existentes: [],
      hoy: HOY,
      origen: 'csv',
    });
    expect(r.saldos.evaluable).toBe(false);
    expect(r.saldos.inicial).toBe(null);
    expect(r.saldos.final).toBe(null);
    expect(r.cantidad.diferencia).toBe(0);
  });
});
