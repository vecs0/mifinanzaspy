// modules/notification-reader/src/NotificationReaderModule.ts
// Capa JS del módulo nativo NotificationReader (Android)

import { EventEmitter, requireNativeModule } from 'expo-modules-core';

// ─── Tipos ───────────────────────────────────────────────────────

export interface NotificationMessage {
  packageName: string;  // "py.com.itau.nmb.android"
  titulo:      string;  // Título de la notificación
  cuerpo:      string;  // Cuerpo / texto expandido
  timestamp:   number;  // Unix epoch ms
}

// ─── Módulo nativo ───────────────────────────────────────────────

const NativeModule = requireNativeModule('NotificationReader');
const emitter = new EventEmitter<{
  onNotificationReceived: (msg: NotificationMessage) => void;
}>(NativeModule);

// ─── API pública ─────────────────────────────────────────────────

/**
 * Verifica si el acceso a notificaciones está habilitado en Ajustes.
 * Si retorna false, llamar a abrirAjustesAcceso() para guiar al usuario.
 */
export async function isAccesoHabilitado(): Promise<boolean> {
  return NativeModule.isAccesoHabilitado();
}

/**
 * Abre la pantalla del sistema "Acceso a notificaciones".
 * Desde ahí el usuario puede activar la app manualmente.
 */
export async function abrirAjustesAcceso(): Promise<void> {
  return NativeModule.abrirAjustesAcceso();
}

/**
 * Suscribirse a notificaciones bancarias entrantes.
 * El listener se invoca por cada notificación de una app bancaria.
 * IMPORTANTE: Filtrar por packageName en el listener para solo procesar
 * notificaciones de bancos que el usuario tiene configurados.
 */
export function addNotificationListener(
  listener: (msg: NotificationMessage) => void,
): ReturnType<typeof emitter.addListener> {
  return emitter.addListener('onNotificationReceived', listener);
}
