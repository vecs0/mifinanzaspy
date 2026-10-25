import {
  esPuntoDeSalida,
  resolverBack,
  type EstadoBack,
} from '../services/navegacionBack';

const base: EstadoBack = {
  capaActiva: 'ninguna',
  indexTab: 0,
  tabsDebajo: true,
  onboardingEnCurso: false,
  dialogoSalidaVisible: false,
};

const estado = (parcial: Partial<EstadoBack>): EstadoBack => ({ ...base, ...parcial });

describe('navegacionBack', () => {
  it('B1: modal de ruta y pantalla apilada con tabs debajo vuelven a la capa de tabs', () => {
    const modal = estado({ capaActiva: 'modal-ruta', indexTab: 1 });
    const apilada = estado({ capaActiva: 'pantalla-apilada', indexTab: 2 });

    expect(resolverBack(modal)).toBe('volver');
    expect(resolverBack(apilada)).toBe('volver');
    expect(esPuntoDeSalida(modal)).toBe(false);
    expect(esPuntoDeSalida(apilada)).toBe(false);
  });

  it('B2: raiz de un tab distinto del Panel va al Panel', () => {
    [1, 2, 3, 4].forEach(indexTab => {
      const actual = estado({ indexTab });
      expect(resolverBack(actual)).toBe('ir-a-panel');
      expect(esPuntoDeSalida(actual)).toBe(true);
    });
  });

  it('B3: raiz del Panel sin capas ofrece el dialogo de salida', () => {
    const panel = estado({ indexTab: 0 });
    expect(resolverBack(panel)).toBe('mostrar-dialogo-salida');
    expect(esPuntoDeSalida(panel)).toBe(true);
  });

  it('B4: dialogo de salida visible se cierra y gana sobre cualquier otra capa', () => {
    const casos: Partial<EstadoBack>[] = [
      { dialogoSalidaVisible: true },
      { dialogoSalidaVisible: true, indexTab: 3 },
      { dialogoSalidaVisible: true, capaActiva: 'modal-ruta', indexTab: 2 },
      { dialogoSalidaVisible: true, capaActiva: 'modal-componente', indexTab: 1 },
      { dialogoSalidaVisible: true, onboardingEnCurso: true },
      { dialogoSalidaVisible: true, tabsDebajo: false },
    ];

    casos.forEach(parcial => {
      const actual = estado(parcial);
      expect(resolverBack(actual)).toBe('cerrar-dialogo');
      expect(esPuntoDeSalida(actual)).toBe(false);
    });
  });

  it('B5: modal de componente y vista interna cierran la capa mas interna', () => {
    const componente = estado({ capaActiva: 'modal-componente' });
    const interna = estado({ capaActiva: 'vista-interna', indexTab: 4 });

    expect(resolverBack(componente)).toBe('cerrar-capa');
    expect(resolverBack(interna)).toBe('cerrar-capa');
    expect(esPuntoDeSalida(componente)).toBe(false);
    expect(esPuntoDeSalida(interna)).toBe(false);

    expect(resolverBack(estado({ capaActiva: 'modal-componente', indexTab: 2 }))).toBe('cerrar-capa');
    expect(resolverBack(estado({ capaActiva: 'vista-interna', tabsDebajo: false }))).toBe('cerrar-capa');
    expect(resolverBack(estado({ capaActiva: 'modal-componente', onboardingEnCurso: true }))).toBe('dejar-al-sistema');
  });

  it('B6: onboarding deja el back al sistema y no ofrece salida', () => {
    const onboarding = estado({ onboardingEnCurso: true });
    expect(resolverBack(onboarding)).toBe('dejar-al-sistema');
    expect(esPuntoDeSalida(onboarding)).toBe(false);
    expect(resolverBack(estado({ onboardingEnCurso: true, indexTab: 3 }))).toBe('dejar-al-sistema');
    expect(resolverBack(estado({ onboardingEnCurso: true, tabsDebajo: false }))).toBe('dejar-al-sistema');
  });

  it('B7: sin tabs debajo va al Panel y nunca propone salir', () => {
    const casos: Partial<EstadoBack>[] = [
      { tabsDebajo: false },
      { tabsDebajo: false, indexTab: 3 },
      { tabsDebajo: false, capaActiva: 'pantalla-apilada', indexTab: 0 },
      { tabsDebajo: false, capaActiva: 'modal-ruta', indexTab: 2 },
    ];

    casos.forEach(parcial => {
      const actual = estado(parcial);
      expect(resolverBack(actual)).toBe('ir-a-panel');
      expect(resolverBack(actual)).not.toBe('mostrar-dialogo-salida');
      expect(esPuntoDeSalida(actual)).toBe(true);
    });
  });

  it('B8: dos llamadas con estados distintos no arrastran memoria', () => {
    const panel = Object.freeze(estado({ indexTab: 0 }));
    const otroTab = Object.freeze(estado({ indexTab: 2 }));
    const capa = Object.freeze(estado({ capaActiva: 'vista-interna', indexTab: 1, tabsDebajo: true }));

    const primera = resolverBack(panel);
    const segunda = resolverBack(otroTab);
    const tercera = resolverBack(capa);

    expect(primera).toBe('mostrar-dialogo-salida');
    expect(segunda).toBe('ir-a-panel');
    expect(tercera).toBe('cerrar-capa');

    expect(resolverBack(otroTab)).toBe('ir-a-panel');
    expect(resolverBack(panel)).toBe('mostrar-dialogo-salida');
    expect(resolverBack(capa)).toBe('cerrar-capa');
    expect(panel).toEqual(estado({ indexTab: 0 }));
    expect(esPuntoDeSalida(panel)).toBe(true);
    expect(esPuntoDeSalida(capa)).toBe(false);
  });
});
