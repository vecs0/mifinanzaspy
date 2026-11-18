/**
 * estadoPresupuesto
 * Responsabilidad: porcentaje real, exceso y restante de un presupuesto; un gasto sobre el limite se marca excedido y no se recorta a 100
 * Usado por: jest
 * Depende de: services/budgets
 */
import { estadoPresupuesto } from '@/services/budgets';

jest.mock('@/services/database', () => ({ getDB: jest.fn() }));

describe('estadoPresupuesto', () => {
  it('marca excedido y calcula el exceso cuando el gasto supera el limite', () => {
    expect(estadoPresupuesto(1213000, 900000)).toEqual({
      pct: 135,
      excedido: true,
      restante: 0,
      exceso: 313000,
    });
  });

  it('calcula lo que queda cuando el gasto esta por debajo del limite', () => {
    expect(estadoPresupuesto(144000, 700000)).toEqual({
      pct: 21,
      excedido: false,
      restante: 556000,
      exceso: 0,
    });
  });

  it('no marca excedido cuando el gasto es igual al limite', () => {
    expect(estadoPresupuesto(500000, 500000)).toEqual({
      pct: 100,
      excedido: false,
      restante: 0,
      exceso: 0,
    });
  });

  it('devuelve cero sin excedido cuando el limite es cero', () => {
    expect(estadoPresupuesto(10000, 0)).toEqual({
      pct: 0,
      excedido: false,
      restante: 0,
      exceso: 0,
    });
  });
});
