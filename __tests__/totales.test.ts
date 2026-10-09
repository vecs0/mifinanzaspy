import { calcularResumenMes, esComputable, FilaMovimiento } from '../services/totales';
import { localMonthKey } from '../services/dateKeys';

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
