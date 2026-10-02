import { detectarDuplicados } from '@/services/duplicateDetector';
import { detectarContraparte, procesarLoteMovimientos } from '@/services/traspasoDetector';
import { getDB } from '@/services/database';

jest.mock('@/services/database', () => ({
  getDB: jest.fn(),
}));

function fila(o: Record<string, unknown>) {
  return {
    id: 'x',
    cuenta_id: 'c1',
    banco_id: 'itau',
    monto: -100000,
    tipo: 'debito',
    categoria_id: 'otros',
    descripcion: 'Compra',
    fuente: 'manual',
    fecha: '2026-06-10T10:00:00.000Z',
    saldo_post: null,
    sms_raw: null,
    procesado: 0,
    notas: null,
    adjunto: null,
    ...o,
  };
}

function conFilas(filas: Record<string, unknown>[]) {
  (getDB as jest.Mock).mockReturnValue({ getAllSync: jest.fn(() => filas) });
}

describe('detectarDuplicados', () => {
  it('sin filas devuelve vacio', () => {
    conFilas([]);
    expect(detectarDuplicados()).toEqual([]);
  });

  it('marca duplicado exacto con score 80', () => {
    conFilas([fila({ id: 'a' }), fila({ id: 'b' })]);
    const r = detectarDuplicados();
    expect(r).toHaveLength(1);
    expect(r[0].score).toBe(80);
  });

  it('ignora montos distintos en otra cuenta y dia', () => {
    conFilas([
      fila({ id: 'a' }),
      fila({ id: 'b', monto: -5000, cuenta_id: 'c2', banco_id: 'gnb', descripcion: 'Otra', fecha: '2026-06-20T10:00:00.000Z' }),
    ]);
    expect(detectarDuplicados()).toEqual([]);
  });

  it('compara monto por valor absoluto (egreso vs ingreso igual)', () => {
    conFilas([fila({ id: 'a' }), fila({ id: 'b', monto: 100000 })]);
    expect(detectarDuplicados()[0].score).toBe(80);
  });

  it('ordena por score descendente', () => {
    conFilas([
      fila({ id: 'a' }),
      fila({ id: 'b', descripcion: 'Distinta' }),
      fila({ id: 'c' }),
    ]);
    const r = detectarDuplicados();
    const scores = r.map(d => d.score);
    expect(scores).toEqual([...scores].sort((x, y) => y - x));
    expect(r[0].score).toBe(80);
  });

  it('mapea procesado a booleano', () => {
    conFilas([fila({ id: 'a', procesado: 1 }), fila({ id: 'b' })]);
    expect(detectarDuplicados()[0].original.procesado).toBe(true);
  });
});

describe('detectarContraparte', () => {
  const cuentas = [
    { id: 'c-itau', bancoId: 'itau', alias: 'Itau' },
    { id: 'c-cont', bancoId: 'continental', alias: 'Continental' },
  ];

  it('frase de traspaso propio con cuenta par', () => {
    const r = detectarContraparte('Transferencia a mi cuenta Continental', cuentas, 'itau');
    expect(r.esTraspaso).toBe(true);
    expect(r.contraparteBancoId).toBe('continental');
    expect(r.cuentaParId).toBe('c-cont');
    expect(r.confianza).toBe('alta');
  });

  it('banco propio mencionado sin nombre de tercero es traspaso', () => {
    const r = detectarContraparte('Envio Continental', cuentas, 'itau');
    expect(r.esTraspaso).toBe(true);
    expect(r.cuentaParId).toBe('c-cont');
  });

  it('transferencia a tercero con nombre no es traspaso', () => {
    const r = detectarContraparte('Transferencia a Maria Gonzalez - Continental', cuentas, 'itau');
    expect(r.contraparteNombre).toBe('Maria Gonzalez');
    expect(r.esTraspaso).toBe(false);
  });

  it('banco sin cuenta del usuario da confianza media', () => {
    const r = detectarContraparte('Traspaso de fondos a Sudameris', cuentas, 'itau');
    expect(r.esTraspaso).toBe(true);
    expect(r.contraparteBancoId).toBe('sudameris');
    expect(r.cuentaParId).toBeNull();
    expect(r.confianza).toBe('media');
  });

  it('descripcion comun no es traspaso', () => {
    const r = detectarContraparte('Compra supermercado Stock', cuentas, 'itau');
    expect(r.esTraspaso).toBe(false);
    expect(r.confianza).toBe('baja');
  });

  it('no detecta el propio banco del extracto', () => {
    const r = detectarContraparte('Comision Itau', cuentas, 'itau');
    expect(r.contraparteBancoId).toBeNull();
  });
});

describe('procesarLoteMovimientos', () => {
  it('mapea resultados con esTraspaso 0/1', () => {
    const cuentas = [{ id: 'c-cont', bancoId: 'continental', alias: 'C' }];
    const r = procesarLoteMovimientos(
      [
        { id: 'm1', descripcion: 'Transferencia propia', tipo: 'debito', bancoId: 'itau', cuentaId: 'c1' },
        { id: 'm2', descripcion: 'Compra Stock', tipo: 'debito', bancoId: 'itau', cuentaId: 'c1' },
      ],
      cuentas,
    );
    expect(r.map(x => x.esTraspaso)).toEqual([1, 0]);
    expect(r[0].transaccionId).toBe('m1');
  });
});
