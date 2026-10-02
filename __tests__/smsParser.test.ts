import { parsearSMS, parsearSMSSincrono, esSMSBancario } from '@/services/smsParser';
import { detectarBancoPorRemitente, parsearMontoGuarani } from '@/constants/smsPatterns';
import { getCuentas } from '@/services/database';

jest.mock('@/services/database', () => ({
  getCuentas: jest.fn(),
  getReglas: jest.fn(() => []),
  insertRegla: jest.fn(),
}));

const mockGetCuentas = getCuentas as jest.Mock;
const FECHA = Date.UTC(2026, 5, 10, 15, 30);

const SMS_ITAU_DEBITO =
  'Itau: Debito Gs. 150.000 en STOCK SUPERMERCADO. Saldo: Gs. 2.350.000';
const SMS_ITAU_DEBITO_TILDE =
  'Itaú: Débito Gs. 150.000 en STOCK SUPERMERCADO. Saldo: Gs. 2.350.000';
const SMS_ITAU_CREDITO =
  'Itaú: Crédito Gs. 4.500.000 en SUELDO EMPRESA SA. Saldo: Gs. 6.850.000';

beforeEach(() => {
  mockGetCuentas.mockReset().mockResolvedValue([
    { id: 'cta-itau', bancoId: 'itau', activa: true },
    { id: 'cta-gnb', bancoId: 'gnb', activa: false },
  ]);
});

describe('parsearMontoGuarani', () => {
  it.each([
    ['1.500.000', 1500000],
    ['1,500,000', 1500000],
    ['150.000', 150000],
    ['900', 900],
    ['2.350.000.', 2350000],
  ])('%s -> %d', (raw, esperado) => {
    expect(parsearMontoGuarani(raw)).toBe(esperado);
  });
});

describe('detectarBancoPorRemitente', () => {
  it.each([
    ['ITAU', 'itau'],
    ['37828', 'itau'],
    ['Continental', 'continental'],
    ['GNBPY', 'gnb'],
    ['VisionBanco', 'vision'],
    ['TigoMoney', 'tigo_money'],
    ['DESCONOCIDO', null],
  ])('%s -> %s', (rem, esperado) => {
    expect(detectarBancoPorRemitente(rem)).toBe(esperado);
  });
});

describe('esSMSBancario', () => {
  it('reconoce por remitente', () => {
    expect(esSMSBancario('ITAU', 'hola')).toBe(true);
  });
  it('reconoce por cuerpo con monto Gs', () => {
    expect(esSMSBancario('12345', 'Usted pago Gs. 50.000 hoy')).toBe(true);
  });
  it('rechaza SMS comun', () => {
    expect(esSMSBancario('Mama', 'Llego tarde a cenar')).toBe(false);
  });
});

describe('parsearSMS', () => {
  it('debito Itau: monto negativo entero, saldo y comercio', async () => {
    const r = await parsearSMS('ITAU', SMS_ITAU_DEBITO_TILDE, FECHA);
    expect(r.reconocido).toBe(true);
    expect(r.bancoId).toBe('itau');
    expect(r.cuentaId).toBe('cta-itau');
    expect(r.transaccion).toMatchObject({
      monto: -150000,
      tipo: 'debito',
      descripcion: 'STOCK SUPERMERCADO',
      saldoPost: 2350000,
      categoriaId: 'supermercado',
      fuente: 'sms',
      fecha: '2026-06-10',
    });
    expect(Number.isInteger(r.transaccion!.monto)).toBe(true);
    expect(r.confianza).toBe('alta');
  });

  test.failing('debito sin tilde ("Debito", SMS sin acentos) debe reconocerse', async () => {
    const r = await parsearSMS('ITAU', SMS_ITAU_DEBITO, FECHA);
    expect(r.transaccion).not.toBeNull();
    expect(r.transaccion!.monto).toBe(-150000);
  });

  it('credito Itau: monto positivo', async () => {
    const r = await parsearSMS('ITAU', SMS_ITAU_CREDITO, FECHA);
    expect(r.transaccion).toMatchObject({
      monto: 4500000,
      tipo: 'credito',
      saldoPost: 6850000,
    });
  });

  it('Continental compra con comercio', async () => {
    mockGetCuentas.mockResolvedValue([{ id: 'cta-cont', bancoId: 'continental', activa: true }]);
    const r = await parsearSMS(
      'CONTINENTAL',
      'Compra Gs 89.500 comercio BIGGIE EXPRESS Gs 89.500 Saldo 1.200.000',
      FECHA,
    );
    expect(r.transaccion).toMatchObject({
      monto: -89500,
      tipo: 'debito',
      descripcion: 'BIGGIE EXPRESS',
      categoriaId: 'supermercado',
      saldoPost: 1200000,
    });
  });

  it('GNB debito', async () => {
    mockGetCuentas.mockResolvedValue([{ id: 'cta-gnb', bancoId: 'gnb', activa: true }]);
    const r = await parsearSMS('GNB', 'Débito 75.000 Gs UBER TRIP por Gs 75.000 Saldo 500.000', FECHA);
    expect(r.transaccion!.monto).toBe(-75000);
    expect(r.transaccion!.tipo).toBe('debito');
  });

  it('remitente desconocido', async () => {
    const r = await parsearSMS('MAMA', 'Gs 1.000', FECHA);
    expect(r.reconocido).toBe(false);
    expect(r.transaccion).toBeNull();
    expect(r.razon).toContain('MAMA');
  });

  it('banco reconocido sin monto valido', async () => {
    const r = await parsearSMS('ITAU', 'Itaú: su clave fue actualizada', FECHA);
    expect(r.reconocido).toBe(true);
    expect(r.transaccion).toBeNull();
    expect(r.confianza).toBe('baja');
  });

  it('banco reconocido sin cuenta activa configurada', async () => {
    mockGetCuentas.mockResolvedValue([{ id: 'x', bancoId: 'itau', activa: false }]);
    const r = await parsearSMS('ITAU', SMS_ITAU_DEBITO_TILDE, FECHA);
    expect(r.reconocido).toBe(true);
    expect(r.cuentaId).toBeNull();
    expect(r.transaccion).toBeNull();
    expect(r.confianza).toBe('media');
  });

  it('error de DB no lanza', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockGetCuentas.mockRejectedValue(new Error('db'));
    const r = await parsearSMS('ITAU', SMS_ITAU_DEBITO_TILDE, FECHA);
    expect(r.transaccion).toBeNull();
    warn.mockRestore();
  });

  it('acepta fecha ISO string', async () => {
    const r = await parsearSMS('ITAU', SMS_ITAU_DEBITO_TILDE, '2026-06-10T12:00:00.000Z');
    expect(r.transaccion!.fecha).toBe('2026-06-10');
  });

  it('monto cero se rechaza', async () => {
    const r = await parsearSMS('ITAU', 'Itaú: Débito Gs. 0 en NADA', FECHA);
    expect(r.transaccion).toBeNull();
  });

  test.failing('transferencia recibida (credito) debe quedar con monto positivo', async () => {
    mockGetCuentas.mockResolvedValue([{ id: 'cta-itau', bancoId: 'itau', activa: true }]);
    const r = await parsearSMS(
      'ITAU',
      'Itaú: Crédito Gs. 300.000 transferencia recibida de JUAN PEREZ. Saldo: Gs. 1.300.000',
      FECHA,
    );
    expect(r.transaccion!.monto).toBe(300000);
  });
});

describe('parsearSMSSincrono', () => {
  it('debito', () => {
    const t = parsearSMSSincrono('ITAU', SMS_ITAU_DEBITO_TILDE, FECHA, 'cta-1');
    expect(t).toMatchObject({
      cuentaId: 'cta-1',
      bancoId: 'itau',
      monto: -150000,
      tipo: 'debito',
      saldoPost: 2350000,
    });
  });

  it('credito', () => {
    const t = parsearSMSSincrono('ITAU', SMS_ITAU_CREDITO, FECHA, 'cta-1');
    expect(t!.monto).toBe(4500000);
  });

  it('bancoIdOverride', () => {
    const t = parsearSMSSincrono('9999', SMS_ITAU_DEBITO_TILDE, FECHA, 'cta-1', 'itau');
    expect(t).not.toBeNull();
  });

  it('retorna null si remitente desconocido o sin monto', () => {
    expect(parsearSMSSincrono('MAMA', SMS_ITAU_DEBITO_TILDE, FECHA, 'c')).toBeNull();
    expect(parsearSMSSincrono('ITAU', 'hola', FECHA, 'c')).toBeNull();
  });

  test.failing('transferencia recibida (credito) debe quedar con monto positivo', () => {
    const t = parsearSMSSincrono(
      'ITAU',
      'Itaú: Crédito Gs. 300.000 transferencia recibida de JUAN PEREZ. Saldo: Gs. 1.300.000',
      FECHA,
      'cta-1',
    );
    expect(t!.monto).toBe(300000);
  });
});

describe('parsearMontoGuarani decimales', () => {
  it('redondea a entero guaranies', () => {
    expect(parsearMontoGuarani('1.500,50')).toBe(1501);
    expect(parsearMontoGuarani('1.500,00')).toBe(1500);
  });
});
