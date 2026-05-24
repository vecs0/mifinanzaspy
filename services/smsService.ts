// services/smsService.ts — Puente entre el módulo nativo SmsReader y la DB
// Importa SMS históricos y escucha en tiempo real. Llama a smsParser + insertTransaccion.

import { Platform } from 'react-native';
import { esSMSBancario, parsearSMS } from './smsParser';
import { insertTransaccion, getCuentas, updateSaldoCuenta } from './database';
import { BANKS } from '@/constants/banks';

// ─── Import condicional del módulo nativo ───────────────────────
// Solo existe en Android; en iOS / web es un no-op.
let SmsReader: typeof import('../modules/sms-reader/src') | null = null;
if (Platform.OS === 'android') {
  try {
    SmsReader = require('../modules/sms-reader/src');
  } catch {
    console.warn('[SmsService] Módulo nativo SmsReader no disponible (modo Expo Go o iOS).');
  }
}

// ─── Importar historial bancario ─────────────────────────────────

/**
 * Lee los últimos SMS bancarios del inbox y los inserta en la DB.
 * Devuelve cuántos se importaron nuevos.
 */
export async function importarHistorialSMS(): Promise<number> {
  if (!SmsReader) return 0;

  const permisos = await SmsReader.getEstadoPermisos();
  if (!permisos.leer) return 0;

  // Obtener todos los remitentes de bancos configurados
  const cuentas = await getCuentas();
  const bancoIds = [...new Set(cuentas.map(c => c.bancoId))];
  const remitentes = bancoIds.flatMap(id => {
    const banco = BANKS.find(b => b.id === id);
    return banco?.remitentes ?? [];
  });

  const mensajes = await SmsReader.leerSMSBancarios(remitentes, 200);
  let importados = 0;

  for (const msg of mensajes) {
    if (!esSMSBancario(msg.remitente, msg.cuerpo)) continue;
    try {
      const resultado = await parsearSMS(msg.remitente, msg.cuerpo, msg.timestamp);
      if (resultado.transaccion && resultado.cuentaId) {
        await insertTransaccion(resultado.transaccion);
        importados++;
        // Actualizar saldo si el SMS trae saldo posterior
        if (resultado.transaccion.saldoPost !== null) {
          await updateSaldoCuenta(resultado.cuentaId, resultado.transaccion.saldoPost);
        }
      }
    } catch (e) {
      console.warn('[SmsService] Error parseando SMS:', e);
    }
  }

  return importados;
}

// ─── Escucha de SMS en tiempo real ───────────────────────────────

let _smsSubscription: { remove: () => void } | null = null;

/**
 * Inicia la escucha de SMS entrantes.
 * Llama a esto desde el componente raíz o cuando se concede el permiso.
 */
export function iniciarEscuchaSMS(
  onNuevoMovimiento?: (cuentaId: string, monto: number) => void,
): void {
  if (!SmsReader) return;
  if (_smsSubscription) return; // ya activo

  _smsSubscription = SmsReader.addSmsListener(async (msg) => {
    if (!esSMSBancario(msg.remitente, msg.cuerpo)) return;
    try {
      const resultado = await parsearSMS(msg.remitente, msg.cuerpo, msg.timestamp);
      if (resultado.transaccion && resultado.cuentaId) {
        await insertTransaccion(resultado.transaccion);
        if (resultado.transaccion.saldoPost !== null) {
          await updateSaldoCuenta(resultado.cuentaId, resultado.transaccion.saldoPost);
        }
        onNuevoMovimiento?.(resultado.cuentaId, resultado.transaccion.monto);
      }
    } catch (e) {
      console.warn('[SmsService] Error procesando SMS entrante:', e);
    }
  });
}

/**
 * Detiene la escucha de SMS.
 */
export function detenerEscuchaSMS(): void {
  _smsSubscription?.remove();
  _smsSubscription = null;
}

// ─── Solicitar permisos (UI helper) ─────────────────────────────

export async function solicitarPermisosLecturaSMS(): Promise<boolean> {
  if (!SmsReader) return false;
  const permisos = await SmsReader.solicitarPermisosLectura();
  return permisos.leer && permisos.recibir;
}

export async function getPermisosLecturaSMS(): Promise<{ leer: boolean; recibir: boolean }> {
  if (!SmsReader) return { leer: false, recibir: false };
  return SmsReader.getEstadoPermisos();
}
