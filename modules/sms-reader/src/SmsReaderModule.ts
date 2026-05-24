// modules/sms-reader/src/SmsReaderModule.ts
// Capa JS del módulo nativo SmsReader (Android)
// Expone funciones para solicitar permisos SMS y escuchar mensajes entrantes.

import { EventEmitter, requireNativeModule } from 'expo-modules-core';

// ─── Tipos ───────────────────────────────────────────────────────

export interface SmsMessage {
  remitente:  string;   // "ITAU", "37828", etc.
  cuerpo:     string;   // Texto completo del SMS
  timestamp:  number;   // Unix epoch en milisegundos
}

export interface SmsPermissionStatus {
  leer:    boolean;   // READ_SMS
  recibir: boolean;   // RECEIVE_SMS
}

// ─── Módulo nativo ───────────────────────────────────────────────

const NativeModule = requireNativeModule('SmsReader');
const emitter = new EventEmitter<{
  onSmsReceived: (mensaje: SmsMessage) => void;
}>(NativeModule);

// ─── API pública ─────────────────────────────────────────────────

/**
 * Solicita los permisos READ_SMS y RECEIVE_SMS al usuario.
 * Retorna el estado resultante de los permisos.
 */
export async function solicitarPermisosLectura(): Promise<SmsPermissionStatus> {
  return NativeModule.solicitarPermisosLectura();
}

/**
 * Lee el estado actual de los permisos SMS sin mostrar diálogos.
 */
export async function getEstadoPermisos(): Promise<SmsPermissionStatus> {
  return NativeModule.getEstadoPermisos();
}

/**
 * Lee los últimos N SMS del dispositivo (requiere READ_SMS).
 * Útil para importar mensajes históricos de bancos.
 */
export async function leerHistorialSMS(limite: number = 50): Promise<SmsMessage[]> {
  return NativeModule.leerHistorialSMS(limite);
}

/**
 * Suscribirse a SMS entrantes en tiempo real (requiere RECEIVE_SMS).
 * El listener se invoca por cada SMS recibido mientras la app está en primer plano.
 */
export function addSmsListener(
  listener: (mensaje: SmsMessage) => void,
): ReturnType<typeof emitter.addListener> {
  return emitter.addListener('onSmsReceived', listener);
}

/**
 * Lee los últimos N SMS de remitentes bancarios conocidos.
 * Filtra en nativo para no saturar el puente JS.
 */
export async function leerSMSBancarios(
  remitentes: string[],
  limite: number = 100,
): Promise<SmsMessage[]> {
  return NativeModule.leerSMSBancarios(remitentes, limite);
}
