import { mergeSplitTransactions, validarItems } from '../services/transaccionValidator';
import type { ItemValidable } from '../services/transaccionValidator';

function fila(parte: Partial<ItemValidable> & { monto: number }): ItemValidable {
  return {
    descripcion: 'Movimiento de prueba',
    fecha: '2026-10-15T12:00',
    ...parte,
  };
}

function capacidad(): [ItemValidable, ItemValidable] {
  return [
    fila({ monto: -100_000, descripcion: 'Pago A', fecha: '2026-10-15T09:00' }),
    fila({ monto: -500_000, descripcion: 'Pago B', fecha: '2026-10-15T10:00' }),
  ];
}

describe('mergeSplitTransactions no destructivo', () => {
  it('fusiona el par y devuelve las dos filas originales en fusiones', () => {
    const [a, b] = capacidad();
    const r = mergeSplitTransactions([a, b]);
    expect(r.mergedCount).toBe(1);
    expect(r.items).toHaveLength(1);
    expect(r.items[0].monto).toBe(-600_000);
    expect(r.fusiones).toHaveLength(1);
    expect(r.fusiones[0].fusionada.monto).toBe(-600_000);
    expect(r.fusiones[0].originales).toEqual([a, b]);
  });

  it('conserva la suma total de montos', () => {
    const par = capacidad();
    const extra = fila({ monto: 25_000, fecha: '2026-10-16' });
    const entrada = [...par, extra];
    const r = mergeSplitTransactions(entrada);
    const sumaDe = (lista: ItemValidable[]) =>
      lista.reduce((s, i) => s + i.monto, 0);
    expect(sumaDe(r.items)).toBe(sumaDe(entrada));
  });

  it('no muta la lista de entrada', () => {
    const entrada = capacidad();
    const copia = JSON.parse(JSON.stringify(entrada));
    mergeSplitTransactions(entrada);
    expect(JSON.stringify(entrada)).toBe(JSON.stringify(copia));
  });

  it('las fusiones permiten deshacer y reconstruir las dos filas originales', () => {
    const [a, b] = capacidad();
    const extra = fila({ monto: 25_000, fecha: '2026-10-16' });
    const r = mergeSplitTransactions([...[a, b], extra]);
    let deshecho = [...r.items];
    for (const { fusionada, originales } of r.fusiones) {
      const indice = deshecho.findIndex(
        i => i.monto === fusionada.monto && i.descripcion === fusionada.descripcion
      );
      deshecho = [
        ...deshecho.slice(0, indice),
        ...originales,
        ...deshecho.slice(indice + 1),
      ];
    }
    expect(deshecho).toHaveLength(3);
    expect(deshecho).toEqual(expect.arrayContaining([a, b, extra]));
  });

  it('sin pares que fusionar devuelve fusiones vacia y las filas iguales', () => {
    const entrada = [
      fila({ monto: -100_000, fecha: '2026-10-15' }),
      fila({ monto: -300_000, fecha: '2026-10-16' }),
    ];
    const copia = JSON.parse(JSON.stringify(entrada));
    const r = mergeSplitTransactions(entrada);
    expect(r.mergedCount).toBe(0);
    expect(r.fusiones).toEqual([]);
    expect(r.items).toHaveLength(2);
    expect(JSON.stringify(entrada)).toBe(JSON.stringify(copia));
  });

  it('fusiona dos pares en el mismo lote y conserva las dos fusiones', () => {
    const entrada = [
      fila({ monto: -100_000, fecha: '2026-10-15T09:00' }),
      fila({ monto: -500_000, fecha: '2026-10-15T10:00' }),
      fila({ monto: 200_000, fecha: '2026-10-15T11:00' }),
      fila({ monto: 400_000, fecha: '2026-10-15T12:00' }),
    ];
    const r = mergeSplitTransactions(entrada);
    expect(r.mergedCount).toBe(2);
    expect(r.fusiones).toHaveLength(2);
    expect(r.items).toHaveLength(2);
    expect(r.items.reduce((s, i) => s + i.monto, 0)).toBe(0);
  });
});

describe('validarItems: comparacion antes de fusionar', () => {
  it('compara contra la cantidad leida antes de fusionar', () => {
    const [a, b] = capacidad();
    const entrada = [a, b, fila({ monto: 25_000, fecha: '2026-10-16' })];
    const r = validarItems(entrada, { totalEsperado: 3 });
    expect(r.warnings.find(w => w.codigo === 'CANTIDAD_MENOR')).toBeUndefined();
    expect(r.warnings.find(w => w.codigo === 'CANTIDAD_MAYOR')).toBeUndefined();
    expect(r.estadisticas.duplicadosDetectados).toBe(0);
  });

  it('con totalEsperado mayor sigue avisando CANTIDAD_MENOR', () => {
    const entrada = [fila({ monto: -100_000 }), fila({ monto: -50_000, fecha: '2026-10-16' })];
    const r = validarItems(entrada, { totalEsperado: 4 });
    const w = r.warnings.find(x => x.codigo === 'CANTIDAD_MENOR');
    expect(w).toBeDefined();
    expect(w!.nivel).toBe('warning');
  });

  it('el rango de fechas usa storedDayKey en DD/MM/AAAA sin correr de dia', () => {
    const entrada = [
      fila({ monto: -100_000, fecha: '2026-09-30T23:59' }),
      fila({ monto: -50_000, fecha: '2026-10-31T20:00' }),
    ];
    const r = validarItems(entrada);
    expect(r.estadisticas.rangoFechas).toEqual({ desde: '30/09/2026', hasta: '31/10/2026' });
  });

  it('mantiene los niveles de advertencias previas', () => {
    const entrada = [
      fila({ monto: -125_500, fecha: '2026-10-15' }),
      fila({ monto: -125_500, fecha: '2026-10-15' }),
    ];
    const r = validarItems(entrada);
    const dups = r.warnings.find(w => w.codigo === 'DUPLICADOS');
    expect(dups).toBeDefined();
    expect(dups!.nivel).toBe('warning');
    const minimos = validarItems([fila({ monto: 5 })]).warnings.find(
      w => w.codigo === 'MONTOS_MINIMOS'
    );
    expect(minimos).toBeDefined();
    expect(minimos!.nivel).toBe('info');
  });

  it('dos pares fusionados no cambian la cuenta contra el esperado', () => {
    const entrada = [
      fila({ monto: -100_000, fecha: '2026-10-15T09:00' }),
      fila({ monto: -500_000, fecha: '2026-10-15T10:00' }),
      fila({ monto: 200_000, fecha: '2026-10-15T11:00' }),
      fila({ monto: 400_000, fecha: '2026-10-15T12:00' }),
    ];
    const r = validarItems(entrada, { totalEsperado: 4 });
    expect(r.mergedCount).toBe(2);
    expect(r.warnings.find(w => w.codigo === 'CANTIDAD_MENOR')).toBeUndefined();
    expect(r.warnings.find(w => w.codigo === 'CANTIDAD_MAYOR')).toBeUndefined();
  });
});
