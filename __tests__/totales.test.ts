import {
  calcularEgresosPorDia,
  calcularGastosPorBanco,
  calcularNetoDia,
  calcularResumenMes,
  esComputable,
  construirSerie7Dias,
  FilaMovimiento,
} from '../services/totales';
import { localDateKey, localLastDaysKeys, localMonthKey } from '../services/dateKeys';

function fila(parcial: Partial<FilaMovimiento> = {}): FilaMovimiento {
  return {
    monto: 0,
    fecha: '2026-10-05',
    esTraspaso: 0,
    bancoId: null,
    categoriaId: null,
    categoriaNombre: null,
    ...parcial,
  };
}

const MES = localMonthKey(new Date(2026, 9, 8, 23, 30));

describe('totales: resumen del mes', () => {
  it('T1: ingresos excluyen fila positiva con esTraspaso 1', () => {
    const filas = [
      fila({ monto: 5000000 }),
      fila({ monto: 1000000, esTraspaso: 1 }),
    ];
    const r = calcularResumenMes(filas, MES, 6);
    expect(r.ingresos).toBe(5000000);
  });

  it('T2: egresos excluyen fila negativa marcada', () => {
    const filas = [
      fila({ monto: -200000 }),
      fila({ monto: -800000, esTraspaso: 1 }),
    ];
    const r = calcularResumenMes(filas, MES, 6);
    expect(r.egresos).toBe(200000);
  });

  it('T6: fila no marcada con contraparte de tercero y esTraspaso nulo cuentan normal', () => {
    const filas = [
      fila({ monto: -150000, bancoId: 'itau' }),
      fila({ monto: -50000, esTraspaso: null }),
      fila({ monto: 70000, esTraspaso: null }),
    ];
    expect(esComputable({ esTraspaso: null })).toBe(true);
    expect(esComputable({ esTraspaso: 0 })).toBe(true);
    expect(esComputable({ esTraspaso: 1 })).toBe(false);
    const r = calcularResumenMes(filas, MES, 6);
    expect(r.egresos).toBe(200000);
    expect(r.ingresos).toBe(70000);
  });

  it('T8: fila con dia futuro del mismo mes cuenta en el resumen', () => {
    const filas = [
      fila({ monto: -100000, fecha: '2026-10-31' }),
      fila({ monto: 300000, fecha: '2026-10-25T10:00:00' }),
    ];
    const r = calcularResumenMes(filas, MES, 6);
    expect(r.egresos).toBe(100000);
    expect(r.ingresos).toBe(300000);
  });

  it('T9: ultimo dia del mes pertenece a ese mes y primer dia al mes nuevo', () => {
    const filas = [
      fila({ monto: -10000, fecha: '2026-10-31T23:59:59' }),
      fila({ monto: -20000, fecha: '2026-11-01T00:00:00' }),
      fila({ monto: -40000, fecha: '2026-09-30T23:59:59Z' }),
      fila({ monto: 5000, fecha: '2026-10-01' }),
    ];
    const oct = calcularResumenMes(filas, '2026-10', 6);
    expect(oct.egresos).toBe(10000);
    expect(oct.ingresos).toBe(5000);
    const nov = calcularResumenMes(filas, '2026-11', 6);
    expect(nov.egresos).toBe(20000);
    expect(nov.ingresos).toBe(0);
  });

  it('T14: traspaso marcado en moneda distinta se excluye sin conversion', () => {
    const filas = [
      fila({ monto: -1500, esTraspaso: 1, bancoId: 'wise' }),
      fila({ monto: 1500, esTraspaso: 1, bancoId: 'itau' }),
      fila({ monto: -30000 }),
    ];
    const r = calcularResumenMes(filas, MES, 6);
    expect(r.egresos).toBe(30000);
    expect(r.ingresos).toBe(0);
  });

  it('T15: pago a tercero marcado por error se excluye', () => {
    const filas = [
      fila({ monto: -450000, esTraspaso: 1, categoriaId: 'servicios', categoriaNombre: 'Servicios' }),
      fila({ monto: -50000 }),
    ];
    const r = calcularResumenMes(filas, MES, 6);
    expect(r.egresos).toBe(50000);
  });
});

describe('totales: top de categorias del resumen', () => {
  const cat = (id: string, monto: number, extra: Partial<FilaMovimiento> = {}) =>
    fila({ monto, categoriaId: id, categoriaNombre: id.toUpperCase(), ...extra });

  it('T5: categoria solo con traspasos no aparece y el top se completa con las restantes', () => {
    const filas = [
      cat('a', -900000, { esTraspaso: 1 }),
      cat('b', -300000),
      cat('c', -200000),
      cat('d', -100000),
    ];
    const r = calcularResumenMes(filas, MES, 2);
    expect(r.topCategorias.map((c) => c.id)).toEqual(['b', 'c']);
    const todas = calcularResumenMes(filas, MES, 6);
    expect(todas.topCategorias.map((c) => c.id)).toEqual(['b', 'c', 'd']);
  });

  it('T5: traspasos de una categoria con gasto real no suman a su total', () => {
    const filas = [cat('a', -100000), cat('a', -700000, { esTraspaso: 1 })];
    const r = calcularResumenMes(filas, MES, 6);
    expect(r.topCategorias).toEqual([{ id: 'a', nombre: 'A', total: 100000 }]);
  });

  it('T5: orden total DESC y desempate id ASC', () => {
    const filas = [
      cat('z', -50000),
      cat('b', -50000),
      cat('m', -80000),
      cat('a', -20000),
      cat('a', -30000),
    ];
    const r = calcularResumenMes(filas, MES, 6);
    expect(r.topCategorias.map((c) => c.id)).toEqual(['m', 'a', 'b', 'z']);
    expect(r.topCategorias[1].total).toBe(50000);
  });

  it('T5: solo egresos del mes cuentan en el top', () => {
    const filas = [
      cat('a', 400000),
      cat('b', -10000, { fecha: '2026-09-30' }),
      cat('c', -20000, { fecha: '2026-11-01' }),
      cat('d', -30000),
      fila({ monto: -5000 }),
    ];
    const r = calcularResumenMes(filas, MES, 6);
    expect(r.topCategorias).toEqual([{ id: 'd', nombre: 'D', total: 30000 }]);
  });

  it('T5: limiteTop 0 devuelve top vacio', () => {
    const r = calcularResumenMes([cat('a', -1000)], MES, 0);
    expect(r.topCategorias).toEqual([]);
  });
});

describe('totales: transversales del resumen', () => {
  it('T12: mes vacio da ceros y top vacio sin excepciones', () => {
    const r = calcularResumenMes([], MES, 6);
    expect(r).toEqual({ ingresos: 0, egresos: 0, topCategorias: [] });
  });

  it('T12: mes con solo traspasos da ceros y top vacio', () => {
    const filas = [
      fila({ monto: -500000, esTraspaso: 1, categoriaId: 'a', categoriaNombre: 'A' }),
      fila({ monto: 500000, esTraspaso: 1 }),
    ];
    const r = calcularResumenMes(filas, MES, 6);
    expect(r).toEqual({ ingresos: 0, egresos: 0, topCategorias: [] });
  });

  it('T16: no muta las filas de entrada', () => {
    const filas = [
      fila({ monto: -100, categoriaId: 'a', categoriaNombre: 'A' }),
      fila({ monto: 300, esTraspaso: 1 }),
      fila({ monto: 50, fecha: '2026-11-02' }),
    ];
    const copia = JSON.parse(JSON.stringify(filas));
    calcularResumenMes(filas, MES, 6);
    expect(filas).toEqual(copia);
  });

  it('T17: totales enteros y egresos positivos', () => {
    const filas = [
      fila({ monto: -123000, categoriaId: 'a', categoriaNombre: 'A' }),
      fila({ monto: -7000, categoriaId: 'b', categoriaNombre: 'B' }),
      fila({ monto: 900000 }),
    ];
    const r = calcularResumenMes(filas, MES, 6);
    expect(Number.isInteger(r.ingresos)).toBe(true);
    expect(Number.isInteger(r.egresos)).toBe(true);
    expect(r.egresos).toBe(130000);
    expect(r.egresos).toBeGreaterThan(0);
    for (const c of r.topCategorias) {
      expect(Number.isInteger(c.total)).toBe(true);
      expect(c.total).toBeGreaterThan(0);
    }
  });
});

describe('totales: gasto por banco', () => {
  it('T3: mes actual excluye marcados y banco con solo traspasos no aparece', () => {
    const filas = [
      fila({ monto: -100000, bancoId: 'itau' }),
      fila({ monto: -900000, bancoId: 'itau', esTraspaso: 1 }),
      fila({ monto: -700000, bancoId: 'wise', esTraspaso: 1 }),
      fila({ monto: 50000, bancoId: 'itau' }),
    ];
    expect(calcularGastosPorBanco(filas, MES)).toEqual([{ bancoId: 'itau', total: 100000 }]);
  });

  it('T3: otro mes pedido excluye marcados y otros meses', () => {
    const filas = [
      fila({ monto: -30000, bancoId: 'itau', fecha: '2026-09-15' }),
      fila({ monto: -80000, bancoId: 'itau', fecha: '2026-09-30T23:59:59' }),
      fila({ monto: -500000, bancoId: 'itau', fecha: '2026-09-10', esTraspaso: 1 }),
      fila({ monto: -10000, bancoId: 'itau', fecha: '2026-10-01' }),
    ];
    expect(calcularGastosPorBanco(filas, '2026-09')).toEqual([{ bancoId: 'itau', total: 110000 }]);
  });

  it('T3: bancoId nulo descartado', () => {
    const filas = [fila({ monto: -1000, bancoId: null }), fila({ monto: -2000, bancoId: 'a' })];
    expect(calcularGastosPorBanco(filas, MES)).toEqual([{ bancoId: 'a', total: 2000 }]);
  });

  it('T3: orden total DESC y desempate bancoId ASC', () => {
    const filas = [
      fila({ monto: -50000, bancoId: 'z' }),
      fila({ monto: -50000, bancoId: 'b' }),
      fila({ monto: -80000, bancoId: 'm' }),
      fila({ monto: -20000, bancoId: 'a' }),
      fila({ monto: -30000, bancoId: 'a' }),
    ];
    expect(calcularGastosPorBanco(filas, MES).map((g) => g.bancoId)).toEqual(['m', 'a', 'b', 'z']);
  });

  it('T12: mes vacio y solo traspasos dan lista vacia', () => {
    expect(calcularGastosPorBanco([], MES)).toEqual([]);
    const filas = [
      fila({ monto: -500000, bancoId: 'a', esTraspaso: 1 }),
      fila({ monto: 500000, bancoId: 'b', esTraspaso: 1 }),
    ];
    expect(calcularGastosPorBanco(filas, MES)).toEqual([]);
  });

  it('T16: no muta las filas de entrada', () => {
    const filas = [
      fila({ monto: -100, bancoId: 'b' }),
      fila({ monto: -300, bancoId: 'a', esTraspaso: 1 }),
      fila({ monto: -50, bancoId: 'a', fecha: '2026-11-02' }),
    ];
    const copia = JSON.parse(JSON.stringify(filas));
    calcularGastosPorBanco(filas, MES);
    expect(filas).toEqual(copia);
  });

  it('T17: totales enteros y positivos', () => {
    const filas = [
      fila({ monto: -123000, bancoId: 'a' }),
      fila({ monto: -7000, bancoId: 'a' }),
      fila({ monto: -5000, bancoId: 'b' }),
    ];
    const r = calcularGastosPorBanco(filas, MES);
    expect(r[0].total).toBe(130000);
    for (const g of r) {
      expect(Number.isInteger(g.total)).toBe(true);
      expect(g.total).toBeGreaterThan(0);
    }
  });
});

describe('totales: egresos por dia', () => {
  const REF = new Date(2026, 9, 8, 23, 30);
  const keys = localLastDaysKeys(REF, 7);
  const desde = keys[0];
  const hasta = keys[keys.length - 1];

  it('T4: egresos por dia excluyen marcados y suman por dia ascendente', () => {
    const filas = [
      fila({ monto: -100000, fecha: '2026-10-08T10:00:00' }),
      fila({ monto: -50000, fecha: '2026-10-08' }),
      fila({ monto: -900000, fecha: '2026-10-08', esTraspaso: 1 }),
      fila({ monto: -30000, fecha: '2026-10-05T08:00:00' }),
      fila({ monto: 70000, fecha: '2026-10-06' }),
    ];
    expect(calcularEgresosPorDia(filas, desde, hasta)).toEqual([
      { fecha: '2026-10-05', total: 30000 },
      { fecha: '2026-10-08', total: 150000 },
    ]);
  });

  it('T7: dia posterior a hoy y hace 7 dias no entran, hace 6 si', () => {
    expect(desde).toBe('2026-10-02');
    expect(hasta).toBe('2026-10-08');
    const filas = [
      fila({ monto: -1000, fecha: '2026-10-09' }),
      fila({ monto: -2000, fecha: '2026-10-01T23:59:59' }),
      fila({ monto: -4000, fecha: '2026-10-02' }),
      fila({ monto: -8000, fecha: '2026-10-08T23:59:59' }),
    ];
    expect(calcularEgresosPorDia(filas, desde, hasta)).toEqual([
      { fecha: '2026-10-02', total: 4000 },
      { fecha: '2026-10-08', total: 8000 },
    ]);
  });

  it('T13: patas de traspaso evaluadas por separado en meses distintos y borde de ventana', () => {
    const ref = new Date(2026, 10, 3, 0, 15);
    const k = localLastDaysKeys(ref, 7);
    expect(k[0]).toBe('2026-10-28');
    const filas = [
      fila({ monto: -500000, fecha: '2026-10-28', esTraspaso: 1 }),
      fila({ monto: -20000, fecha: '2026-10-28' }),
      fila({ monto: -40000, fecha: '2026-10-27' }),
      fila({ monto: -60000, fecha: '2026-11-03', esTraspaso: 1 }),
      fila({ monto: -80000, fecha: '2026-11-03' }),
      fila({ monto: -5000, fecha: '2026-11-04' }),
    ];
    expect(calcularEgresosPorDia(filas, k[0], k[k.length - 1])).toEqual([
      { fecha: '2026-10-28', total: 20000 },
      { fecha: '2026-11-03', total: 80000 },
    ]);
  });

  it('T12: vacio y solo traspasos dan lista vacia', () => {
    expect(calcularEgresosPorDia([], desde, hasta)).toEqual([]);
    const filas = [
      fila({ monto: -500000, fecha: '2026-10-08', esTraspaso: 1 }),
      fila({ monto: 500000, fecha: '2026-10-08', esTraspaso: 1 }),
    ];
    expect(calcularEgresosPorDia(filas, desde, hasta)).toEqual([]);
  });

  it('T16: no muta las filas de entrada', () => {
    const filas = [
      fila({ monto: -100, fecha: '2026-10-08' }),
      fila({ monto: -300, fecha: '2026-10-07', esTraspaso: 1 }),
      fila({ monto: -50, fecha: '2026-09-01' }),
    ];
    const copia = JSON.parse(JSON.stringify(filas));
    calcularEgresosPorDia(filas, desde, hasta);
    expect(filas).toEqual(copia);
  });

  it('T17: totales enteros y positivos', () => {
    const filas = [
      fila({ monto: -123000, fecha: '2026-10-08' }),
      fila({ monto: -7000, fecha: '2026-10-08' }),
      fila({ monto: -5000, fecha: '2026-10-07' }),
    ];
    const r = calcularEgresosPorDia(filas, desde, hasta);
    expect(r[1].total).toBe(130000);
    for (const e of r) {
      expect(Number.isInteger(e.total)).toBe(true);
      expect(e.total).toBeGreaterThan(0);
    }
  });
});

describe('totales: neto del dia', () => {
  const REF = new Date(2026, 9, 8, 0, 15);
  const dia = localDateKey(REF);

  it('T10: suma con signo, excluye marcados y otros dias', () => {
    const filas = [
      fila({ monto: 500000, fecha: '2026-10-08T09:00:00' }),
      fila({ monto: -120000, fecha: '2026-10-08' }),
      fila({ monto: -900000, fecha: '2026-10-08', esTraspaso: 1 }),
      fila({ monto: 900000, fecha: '2026-10-08', esTraspaso: 1 }),
      fila({ monto: -7000, fecha: '2026-10-07T23:59:59' }),
      fila({ monto: 3000, fecha: '2026-10-09' }),
    ];
    expect(calcularNetoDia(filas, dia)).toBe(380000);
  });

  it('T10: neto negativo conserva el signo', () => {
    expect(calcularNetoDia([fila({ monto: -4000, fecha: '2026-10-08' })], dia)).toBe(-4000);
  });

  it('T12: vacio y solo traspasos dan 0', () => {
    expect(calcularNetoDia([], dia)).toBe(0);
    expect(calcularNetoDia([fila({ monto: -5000, fecha: '2026-10-08', esTraspaso: 1 })], dia)).toBe(0);
  });

  it('T16: no muta las filas de entrada', () => {
    const filas = [fila({ monto: -100, fecha: '2026-10-08' }), fila({ monto: 5, esTraspaso: 1 })];
    const copia = JSON.parse(JSON.stringify(filas));
    calcularNetoDia(filas, dia);
    expect(filas).toEqual(copia);
  });

  it('T17: resultado entero', () => {
    const filas = [fila({ monto: 123000, fecha: '2026-10-08' }), fila({ monto: -7000, fecha: '2026-10-08' })];
    expect(Number.isInteger(calcularNetoDia(filas, dia))).toBe(true);
  });
});

describe('totales: serie de 7 dias', () => {
  const ETQ = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];

  it('T11: 7 barras ascendentes, ceros, solo la ultima esHoy y etiquetas por dia local', () => {
    const ref = new Date(2026, 9, 8, 23, 30);
    const egresos = [
      { fecha: '2026-10-08', total: 300 },
      { fecha: '2026-10-05', total: 150 },
    ];
    const s = construirSerie7Dias(egresos, ref, ETQ);
    expect(s.map((b) => b.key)).toEqual([
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
      '2026-10-08',
    ]);
    expect(s.map((b) => b.total)).toEqual([0, 0, 0, 150, 0, 0, 300]);
    expect(s.map((b) => b.esHoy)).toEqual([false, false, false, false, false, false, true]);
    expect(s.map((b) => b.dia)).toEqual(['Vie', 'Sab', 'Dom', 'Lun', 'Mar', 'Mie', 'Jue']);
  });

  it('T11: cruza de mes y de anio', () => {
    const ref = new Date(2026, 0, 2, 0, 5);
    const s = construirSerie7Dias([{ fecha: '2025-12-31', total: 90 }], ref, ETQ);
    expect(s.map((b) => b.key)).toEqual([
      '2025-12-27',
      '2025-12-28',
      '2025-12-29',
      '2025-12-30',
      '2025-12-31',
      '2026-01-01',
      '2026-01-02',
    ]);
    expect(s.map((b) => b.total)).toEqual([0, 0, 0, 0, 90, 0, 0]);
    expect(s.filter((b) => b.esHoy).length).toBe(1);
    expect(s[6].esHoy).toBe(true);
    expect(s.map((b) => b.dia)).toEqual(['Sab', 'Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie']);
  });

  it('T11: sin egresos devuelve 7 barras en cero', () => {
    const s = construirSerie7Dias([], new Date(2026, 9, 8), ETQ);
    expect(s).toHaveLength(7);
    expect(s.every((b) => b.total === 0)).toBe(true);
  });
});
