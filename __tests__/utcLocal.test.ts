/**
 * utcLocal
 * Responsabilidad: Regresion de las fechas por defecto y claves de mes frente al corrimiento UTC en validacion, alertas, reportes y recordatorios
 * Usado por: jest
 * Depende de: services/validation, services/alerts, services/reportGenerator, services/reminders, services/database
 */
jest.mock('@/services/database', () => {
  const actual = jest.requireActual('@/services/database');
  return {
    ...actual,
    getDB: jest.fn(),
    getReporteCache: jest.fn(() => null),
    setReporteCache: jest.fn(),
  };
});

import { getDB, getReporteCache } from '@/services/database';
import { generarAlertas } from '@/services/alerts';
import { generarReporteDiario, generarReporteMensual } from '@/services/reportGenerator';
import { getRecordatorioProximo } from '@/services/reminders';
import { validarFecha } from '@/services/validation';

interface Consulta {
  sql: string;
  params: unknown[];
}

let consultas: Consulta[] = [];

function conFilas(
  filas: Record<string, unknown>[] = [],
  presupuestos: Record<string, unknown>[] = [],
): void {
  (getDB as jest.Mock).mockReturnValue({
    getAllSync: jest.fn((sql: string, params: unknown[] = []) => {
      consultas.push({ sql, params });
      return sql.includes('FROM presupuestos') ? presupuestos : filas;
    }),
    getFirstSync: jest.fn((sql: string, params: unknown[] = []) => {
      consultas.push({ sql, params });
      return null;
    }),
    runSync: jest.fn(() => ({ changes: 0 })),
    execSync: jest.fn(),
    withTransactionSync: jest.fn((fn: () => unknown) => fn()),
  });
}

function consultaDe(fragmento: string): Consulta | undefined {
  return consultas.find((c) => c.sql.includes(fragmento));
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-11-01T02:30:00Z'));
  consultas = [];
  jest.clearAllMocks();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('zona horaria de la suite', () => {
  it('Z1: la suite corre en America/Asuncion y el instante fijo cae un mes antes en UTC', () => {
    const instante = new Date('2026-11-01T02:30:00Z');
    expect(instante.getFullYear()).toBe(2026);
    expect(instante.getMonth()).toBe(9);
    expect(instante.getDate()).toBe(31);
    expect(instante.getUTCMonth()).toBe(10);
  });
});

describe('validacion: fecha por defecto local', () => {
  it('V1: sin fecha usable devuelve el dia local', () => {
    expect(validarFecha(undefined)).toBe('2026-10-31');
    expect(validarFecha(null)).toBe('2026-10-31');
    expect(validarFecha('no-es-fecha')).toBe('2026-10-31');
    expect(validarFecha('32/13/2026')).toBe('2026-10-31');
  });

  it('V2: una fecha valida se conserva tal cual', () => {
    expect(validarFecha('2026-03-04')).toBe('2026-03-04');
    expect(validarFecha('2026-03-04T23:30:00')).toBe('2026-03-04');
  });
});

describe('alertas: mes actual y mes anterior locales', () => {
  it('A1: consulta gastos y presupuestos con el mes local', () => {
    conFilas();
    generarAlertas();
    expect(consultaDe('substr(fecha,1,7)')?.params).toEqual(['2026-10', '2026-09']);
    expect(consultaDe('FROM presupuestos WHERE mes = ?')?.params).toEqual(['2026-10']);
  });

  it('A2: en enero el mes anterior local cruza el anio', () => {
    jest.setSystemTime(new Date('2026-01-01T02:30:00Z'));
    conFilas();
    generarAlertas();
    expect(consultaDe('substr(fecha,1,7)')?.params).toEqual(['2025-12', '2025-11']);
  });
});

describe('reportes: claves de dia y mes locales', () => {
  it('R1: el reporte diario sin fecha usa el dia local', () => {
    conFilas();
    generarReporteDiario();
    expect(getReporteCache).toHaveBeenCalledWith('diario', '2026-10-31');
  });

  it('R4: la comparacion con ayer resta un dia calendario', () => {
    conFilas();
    generarReporteDiario('2026-10-31');
    expect(consultaDe('COALESCE(SUM(ABS(monto)), 0)')?.params).toEqual(['2026-10-30']);
    generarReporteDiario('2026-03-01');
    expect(consultas.filter((c) => c.sql.includes('COALESCE(SUM(ABS(monto)), 0)')).pop()?.params).toEqual(['2026-02-28']);
  });

  it('R2: el reporte mensual sin argumento usa el mes local y su mes anterior', () => {
    conFilas();
    generarReporteMensual();
    expect(getReporteCache).toHaveBeenCalledWith('mensual', '2026-10');
    expect(consultaDe('strftime(\'%Y-%m\', fecha) = ?')?.params).toEqual(['2026-10']);
    expect(consultaDe('strftime(\'%Y-%m\', fecha) = ? AND monto < 0')?.params).toEqual(['2026-09']);
  });

  it('R3: el mes explicito no se altera y su anterior es el correcto', () => {
    conFilas();
    generarReporteMensual('2026-01');
    expect(getReporteCache).toHaveBeenCalledWith('mensual', '2026-01');
    expect(consultaDe('strftime(\'%Y-%m\', fecha) = ? AND monto < 0')?.params).toEqual(['2025-12']);
  });
});

describe('recordatorios: limite local de tres dias', () => {
  it('D1: consulta hasta el dia local de hoy mas tres', () => {
    conFilas();
    expect(getRecordatorioProximo()).toBeNull();
    expect(consultaDe('FROM recordatorios WHERE activo = 1')?.params).toEqual(['2026-11-03']);
  });
});
