/**
 * consumidoresArchivado
 * Responsabilidad: Regresion de alertas, presupuestos, reportes y detector de duplicados frente a filas archivadas, y SQL de las cuatro consultas de agregados
 * Usado por: jest
 * Depende de: services/alerts, services/budgets, services/reportGenerator, services/duplicateDetector, services/database
 */
jest.mock('expo-sqlite', () => {
  const { default: db } = require('./helpers/sqlCaptura');
  return { openDatabaseSync: () => db };
});

jest.mock('@/services/database', () => {
  const actual = jest.requireActual('@/services/database');
  return {
    ...actual,
    getDB: jest.fn(),
    getReporteCache: jest.fn(() => null),
    setReporteCache: jest.fn(),
  };
});

import {
  getDB,
  getEgresosPorDia,
  getGastosPorBanco,
  getNetoHoy,
  getResumenMesActual,
} from '@/services/database';
import { generarAlertas } from '@/services/alerts';
import { getPresupuestosConGasto } from '@/services/budgets';
import { generarReporteMensual } from '@/services/reportGenerator';
import { detectarDuplicados } from '@/services/duplicateDetector';
import { localMonthKey } from '@/services/dateKeys';
import { captura, reiniciarCaptura } from './helpers/sqlCaptura';

type FilaMock = {
  monto: number;
  fecha: string;
  archivado: number | null;
  categoria_id?: string | null;
  categoriaId?: string | null;
  banco_id?: string | null;
  bancoId?: string | null;
  [clave: string]: unknown;
};

function fila(parcial: Partial<FilaMock> = {}): FilaMock {
  return {
    monto: -100000,
    fecha: '2026-10-05',
    archivado: 0,
    categoria_id: 'supermercado',
    categoriaId: 'supermercado',
    banco_id: 'itau',
    bancoId: 'itau',
    ...parcial,
  };
}

function conFilas(filas: FilaMock[], presupuestos: Record<string, unknown>[] = []): void {
  (getDB as jest.Mock).mockReturnValue({
    getAllSync: jest.fn((sql: string) =>
      sql.includes('FROM presupuestos') ? presupuestos : filas
    ),
    getFirstSync: jest.fn(() => null),
    runSync: jest.fn(() => ({ changes: 0 })),
    execSync: jest.fn(),
    withTransactionSync: jest.fn((fn: () => unknown) => fn()),
  });
}

const MES_ALERTAS = localMonthKey(new Date());

function mesAnteriorDeAlertas(): string {
  const ahora = new Date();
  return localMonthKey(new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1));
}

beforeEach(() => {
  jest.clearAllMocks();
  reiniciarCaptura();
});

describe('consumidores: alertas', () => {
  it('C1: el gasto archivado no se suma a la alerta de gasto creciente', () => {
    const mesAnterior = mesAnteriorDeAlertas();
    conFilas([
      fila({ monto: -100000, fecha: `${MES_ALERTAS}-05`, archivado: 0 }),
      fila({ monto: -2500000, fecha: `${MES_ALERTAS}-06`, archivado: 1 }),
      fila({ monto: -100000, fecha: `${mesAnterior}-05`, archivado: 0 }),
    ]);
    const alertas = generarAlertas();
    expect(alertas.filter((a) => a.tipo === 'gasto_creciente')).toEqual([]);
  });

  it('C1: sin archivados la alerta sigue apareciendo con el monto visible', () => {
    const mesAnterior = mesAnteriorDeAlertas();
    conFilas([
      fila({ monto: -300000, fecha: `${MES_ALERTAS}-05`, archivado: 0 }),
      fila({ monto: -100000, fecha: `${mesAnterior}-05`, archivado: 0 }),
    ]);
    const alertas = generarAlertas();
    expect(alertas.filter((a) => a.tipo === 'gasto_creciente')).toHaveLength(1);
    expect(alertas[0].mensaje).toContain('300.000');
  });
});

describe('consumidores: presupuestos', () => {
  it('C2: el gasto archivado no cuenta en el gastado del presupuesto', () => {
    conFilas(
      [
        fila({ monto: -100000, fecha: '2026-10-05', archivado: 0 }),
        fila({ monto: -400000, fecha: '2026-10-06', archivado: 1 }),
      ],
      [{ id: 'supermercado_2026-10', categoria_id: 'supermercado', monto_limite: 500000, mes: '2026-10' }]
    );
    const presupuestos = getPresupuestosConGasto('2026-10');
    expect(presupuestos).toHaveLength(1);
    expect(presupuestos[0].gastado).toBe(100000);
    expect(presupuestos[0].pct).toBe(20);
  });

  it('C2: sin archivados el gastado no cambia', () => {
    conFilas(
      [fila({ monto: -150000, fecha: '2026-10-05', archivado: 0 })],
      [{ id: 'supermercado_2026-10', categoria_id: 'supermercado', monto_limite: 500000, mes: '2026-10' }]
    );
    const presupuestos = getPresupuestosConGasto('2026-10');
    expect(presupuestos[0].gastado).toBe(150000);
    expect(presupuestos[0].pct).toBe(30);
  });
});

describe('consumidores: reporte mensual', () => {
  it('C3: el egreso archivado no aparece en totales, categorias, bancos ni dias', () => {
    conFilas([
      fila({ monto: -100000, fecha: '2026-10-05', categoriaId: 'supermercado', bancoId: 'itau', archivado: 0 }),
      fila({ monto: 500000, fecha: '2026-10-06', categoriaId: 'salario', bancoId: 'itau', archivado: 0 }),
      fila({ monto: -900000, fecha: '2026-10-07', categoriaId: 'supermercado', bancoId: 'itau', archivado: 1 }),
    ]);
    const reporte = generarReporteMensual('2026-10');
    expect(reporte.totalEgresos).toBe(100000);
    expect(reporte.totalIngresos).toBe(500000);
    expect(reporte.saldoNeto).toBe(400000);
    expect(reporte.topCategorias).toEqual([
      { id: 'salario', total: 500000, nombre: 'Salario', pct: 500 },
      { id: 'supermercado', total: 100000, nombre: 'Supermercado', pct: 100 },
    ]);
    expect(reporte.topBancos).toEqual([
      { bancoId: 'itau', total: 600000, nombre: 'Banco Itaú Paraguay' },
    ]);
    expect(reporte.maxGastoDia).toEqual({ fecha: '2026-10-05', total: 100000 });
    expect(reporte.diasActivos).toBe(2);
    expect(reporte.promedioGastoDiario).toBe(50000);
  });

  it('C3: sin archivados los totales del reporte no cambian', () => {
    conFilas([
      fila({ monto: -200000, fecha: '2026-10-05', categoriaId: 'supermercado', bancoId: 'itau', archivado: 0 }),
      fila({ monto: -50000, fecha: '2026-10-06', categoriaId: 'combustible', bancoId: 'itau', archivado: 0 }),
    ]);
    const reporte = generarReporteMensual('2026-10');
    expect(reporte.totalEgresos).toBe(250000);
    expect(reporte.topCategorias.map((c) => c.id)).toEqual(['supermercado', 'combustible']);
    expect(reporte.maxGastoDia).toEqual({ fecha: '2026-10-05', total: 200000 });
  });
});

describe('consumidores: detector de duplicados', () => {
  it('C4: una fila archivada no se devuelve como posible duplicado', () => {
    conFilas([
      fila({ id: 'a', archivado: 0 }),
      fila({ id: 'b', archivado: 1 }),
    ]);
    expect(detectarDuplicados()).toEqual([]);
  });

  it('C4: dos filas visibles siguen marcandose como duplicado', () => {
    conFilas([
      fila({ id: 'a', archivado: 0 }),
      fila({ id: 'b', archivado: 0 }),
    ]);
    expect(detectarDuplicados()).toHaveLength(1);
  });
});

describe('consultas de agregados: defensa en SQL', () => {
  function sqlDe(fn: () => unknown): string {
    reiniciarCaptura();
    fn();
    return captura.sentencias.join(' ');
  }

  it('Q1: getEgresosPorDia selecciona archivado y filtra archivado = 0', () => {
    const sql = sqlDe(() => getEgresosPorDia(7, new Date(2026, 9, 8)));
    expect(sql).toContain('archivado AS archivado');
    expect(sql).toContain('archivado = 0');
  });

  it('Q2: getResumenMesActual selecciona archivado y filtra archivado = 0', async () => {
    reiniciarCaptura();
    await getResumenMesActual(new Date(2026, 9, 8));
    const sql = captura.sentencias.join(' ');
    expect(sql).toContain('archivado AS archivado');
    expect(sql).toContain('archivado = 0');
  });

  it('Q3: getGastosPorBanco selecciona archivado y filtra archivado = 0', () => {
    const sql = sqlDe(() => getGastosPorBanco('2026-10'));
    expect(sql).toContain('archivado AS archivado');
    expect(sql).toContain('archivado = 0');
  });

  it('Q4: getNetoHoy selecciona archivado y filtra archivado = 0', () => {
    const sql = sqlDe(() => getNetoHoy(new Date(2026, 9, 8)));
    expect(sql).toContain('archivado AS archivado');
    expect(sql).toContain('archivado = 0');
  });
});
