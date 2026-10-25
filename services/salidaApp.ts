/**
 * salidaApp
 * Responsabilidad: Recordar que el usuario pidio salir para reiniciar el splash al reabrir la app
 * Usado por: app/(tabs)/_layout.tsx, app/_layout.tsx, __tests__/salidaApp.test.ts
 * Depende de: nada (estado de modulo)
 */

let salidaSolicitada = false;

export function marcarSalidaSolicitada(): void {
  salidaSolicitada = true;
}

export function consumirSalidaSolicitada(): boolean {
  const solicitada = salidaSolicitada;
  salidaSolicitada = false;
  return solicitada;
}
