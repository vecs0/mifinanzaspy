/**
 * navegacionBack
 * Responsabilidad: Decision pura del back del sistema a partir del estado observable de navegacion
 * Usado por: app/(tabs)/_layout.tsx, app/(tabs)/chat.tsx, __tests__/navegacionBack.test.ts
 * Depende de: nada (sin React, sin router, sin BackHandler)
 */

export type CapaActiva =
  | 'ninguna'
  | 'modal-ruta'
  | 'pantalla-apilada'
  | 'modal-componente'
  | 'vista-interna';

export type EstadoBack = {
  capaActiva: CapaActiva;
  indexTab: number;
  tabsDebajo: boolean;
  onboardingEnCurso: boolean;
  dialogoSalidaVisible: boolean;
};

export type AccionBack =
  | 'cerrar-dialogo'
  | 'cerrar-capa'
  | 'volver'
  | 'ir-a-panel'
  | 'mostrar-dialogo-salida'
  | 'dejar-al-sistema';

export function resolverBack(estado: EstadoBack): AccionBack {
  if (estado.dialogoSalidaVisible) return 'cerrar-dialogo';
  if (estado.onboardingEnCurso) return 'dejar-al-sistema';
  if (estado.capaActiva === 'modal-componente' || estado.capaActiva === 'vista-interna') {
    return 'cerrar-capa';
  }
  if (!estado.tabsDebajo) return 'ir-a-panel';
  if (estado.capaActiva === 'modal-ruta' || estado.capaActiva === 'pantalla-apilada') {
    return 'volver';
  }
  if (estado.indexTab > 0) return 'ir-a-panel';
  return 'mostrar-dialogo-salida';
}

export function esPuntoDeSalida(estado: EstadoBack): boolean {
  const accion = resolverBack(estado);
  return accion === 'ir-a-panel' || accion === 'mostrar-dialogo-salida';
}
