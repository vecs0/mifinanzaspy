type ModuloSalida = typeof import('../services/salidaApp');

const cargar = (): ModuloSalida => {
  jest.resetModules();
  return require('../services/salidaApp') as ModuloSalida;
};

describe('salidaApp', () => {
  it('C1: marcar y consumir una vez devuelve true', () => {
    const { marcarSalidaSolicitada, consumirSalidaSolicitada } = cargar();
    marcarSalidaSolicitada();
    expect(consumirSalidaSolicitada()).toBe(true);
  });

  it('C2: el segundo consumir devuelve false', () => {
    const { marcarSalidaSolicitada, consumirSalidaSolicitada } = cargar();
    marcarSalidaSolicitada();
    expect(consumirSalidaSolicitada()).toBe(true);
    expect(consumirSalidaSolicitada()).toBe(false);
    expect(consumirSalidaSolicitada()).toBe(false);
  });

  it('C3: sin marcar, consumir devuelve false', () => {
    const { consumirSalidaSolicitada } = cargar();
    expect(consumirSalidaSolicitada()).toBe(false);
  });
});
