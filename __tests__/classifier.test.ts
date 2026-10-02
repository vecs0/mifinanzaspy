import {
  clasificarSincrono,
  clasificarTransaccion,
  aprenderRegla,
  calcularProyeccion,
} from '@/services/classifier';
import { getReglas, insertRegla } from '@/services/database';

jest.mock('@/services/database', () => ({
  getReglas: jest.fn(),
  insertRegla: jest.fn(),
}));

const mockGetReglas = getReglas as jest.Mock;
const mockInsertRegla = insertRegla as jest.Mock;

beforeEach(() => {
  mockGetReglas.mockReset().mockReturnValue([]);
  mockInsertRegla.mockReset().mockResolvedValue(undefined);
});

describe('clasificarSincrono', () => {
  it.each([
    ['Pago ANDE julio', -250000, 'servicios'],
    ['ESSAP agua', -80000, 'servicios'],
    ['Recarga Tigo', -20000, 'telefono'],
    ['STOCK Supermercado', -350000, 'supermercado'],
    ['Biggie Express', -120000, 'supermercado'],
    ['Farmacia Catedral', -45000, 'farmacia'],
    ['Petrobras ruta 2', -200000, 'combustible'],
    ['Netflix mensual', -55000, 'ocio'],
    ['Retiro cajero ATM', -500000, 'retiro'],
    ['Sueldo mayo', 4500000, 'salario'],
  ])('%s -> %s', (desc, monto, esperado) => {
    expect(clasificarSincrono(desc, monto)).toBe(esperado);
  });

  it('ignora mayusculas y tildes', () => {
    expect(clasificarSincrono('PRÉSTAMO banco', -100000)).toBe('deuda');
    expect(clasificarSincrono('FERRETERÍA Central', -90000)).toBe('hogar');
  });

  it('fallback: ingreso positivo -> salario, egreso -> otros', () => {
    expect(clasificarSincrono('xyzzy desconocido', 100000)).toBe('salario');
    expect(clasificarSincrono('xyzzy desconocido', -100000)).toBe('otros');
  });

  test('palabras clave con tilde en la tabla deben poder coincidir (inversión)', () => {
    expect(clasificarSincrono('Inversión fondo', -1000000)).toBe('inversion');
  });

  test('no debe clasificar por subcadena dentro de otra palabra (ande en "grande")', () => {
    expect(clasificarSincrono('Compra grande', -100000)).toBe('otros');
  });
});

describe('clasificarTransaccion', () => {
  it('regla de usuario tiene prioridad sobre palabras clave', async () => {
    mockGetReglas.mockReturnValue([
      { id: '1', patronTexto: 'stock', categoriaId: 'mascotas', prioridad: 10, esRegex: false },
    ]);
    await expect(clasificarTransaccion('Compra STOCK', -50000)).resolves.toBe('mascotas');
  });

  it('regla regex', async () => {
    mockGetReglas.mockReturnValue([
      { id: '1', patronTexto: '^pago\\s+\\d+', categoriaId: 'deuda', prioridad: 10, esRegex: true },
    ]);
    await expect(clasificarTransaccion('Pago 123 cuota', -50000)).resolves.toBe('deuda');
  });

  it('regex invalido no lanza y cae a palabras clave', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockGetReglas.mockReturnValue([
      { id: '1', patronTexto: '([', categoriaId: 'x', prioridad: 10, esRegex: true },
    ]);
    await expect(clasificarTransaccion('Uber viaje', -30000)).resolves.toBe('transporte');
    warn.mockRestore();
  });

  it('sin reglas ni keywords usa fallback por signo', async () => {
    await expect(clasificarTransaccion('zzz', 1000)).resolves.toBe('salario');
    await expect(clasificarTransaccion('zzz', -1000)).resolves.toBe('otros');
  });
});

describe('aprenderRegla', () => {
  it('guarda patron con las primeras 3 palabras de 3+ letras', async () => {
    await aprenderRegla('Pago a la panaderia del barrio', 'restaurante');
    expect(mockInsertRegla).toHaveBeenCalledWith({
      patronTexto: 'pago panaderia del',
      categoriaId: 'restaurante',
      prioridad: 10,
      esRegex: false,
    });
  });

  it('no inserta si no hay palabras significativas', async () => {
    await aprenderRegla('a b', 'otros');
    expect(mockInsertRegla).not.toHaveBeenCalled();
  });

  it('limita el patron a 40 caracteres', async () => {
    await aprenderRegla('supercalifragilisticoespialidoso extraordinariamente larguisimo', 'otros');
    expect(mockInsertRegla.mock.calls[0][0].patronTexto.length).toBeLessThanOrEqual(40);
  });
});

describe('calcularProyeccion', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 5, 10, 12));
  });
  afterEach(() => jest.useRealTimers());

  it('devuelve null sin movimientos', () => {
    expect(calcularProyeccion(0, 0, 100000)).toBeNull();
  });

  it('estable hasta 40% gastado', () => {
    const r = calcularProyeccion(5000000, 2000000, 3000000)!;
    expect(r.pctGastado).toBe(40);
    expect(r.estadoSalud).toBe('estable');
    expect(r.diasRestantes).toBe(20);
  });

  it('atencion entre 41 y 70', () => {
    expect(calcularProyeccion(5000000, 3500000, 0)!.estadoSalud).toBe('atencion');
  });

  it('riesgo sobre 70 y sin ingresos', () => {
    expect(calcularProyeccion(5000000, 4000000, 0)!.estadoSalud).toBe('riesgo');
    expect(calcularProyeccion(0, 100000, 0)!.pctGastado).toBe(100);
  });

  it('saldo proyectado resta gasto diario * dias restantes', () => {
    const r = calcularProyeccion(5000000, 1000000, 4000000)!;
    expect(r.saldoProyectado).toBe(4000000 - (1000000 / 10) * 20);
  });
});
