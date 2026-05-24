// services/notificationService.ts — Conecta NotificationReader nativo con la DB
// Filtra notificaciones de apps bancarias activas, parsea el cuerpo como SMS
// y almacena la transacción automáticamente.

import { Platform } from 'react-native';
import { parsearSMSSincrono, esSMSBancario } from './smsParser';
import { insertTransaccion, updateSaldoCuenta, getCuentas } from './database';
import { BANKS } from '@/constants/banks';

// Import condicional — solo Android
let NotificationReader: typeof import('../modules/notification-reader/src') | null = null;
if (Platform.OS === 'android') {
  try {
    NotificationReader = require('../modules/notification-reader/src');
  } catch {
    console.warn('[NotifService] Módulo NotificationReader no disponible.');
  }
}

// ─── Estado interno ─────────────────────────────────────────────
let _subscription: { remove: () => void } | null = null;

// ─── API pública ─────────────────────────────────────────────────

export async function isAccesoNotificacionesHabilitado(): Promise<boolean> {
  return NotificationReader?.isAccesoHabilitado() ?? false;
}

export async function abrirAjustesNotificaciones(): Promise<void> {
  await NotificationReader?.abrirAjustesAcceso();
}

/**
 * Inicia la escucha de notificaciones bancarias.
 * Debe llamarse después de que el usuario confirma el permiso.
 */
export async function iniciarEscuchaNotificaciones(
  onNuevoMovimiento?: (cuentaId: string, monto: number) => void,
): Promise<void> {
  if (!NotificationReader) return;
  if (_subscription) return;

  const habilitado = await NotificationReader.isAccesoHabilitado();
  if (!habilitado) return;

  // Construir mapa packageId → { cuentaId, bancoId }
  const cuentas = await getCuentas();
  const packageMap: Record<string, { cuentaId: string; bancoId: string }> = {};
  for (const cuenta of cuentas) {
    if (cuenta.notifHabilitada && cuenta.activa) {
      packageMap[cuenta.appPackage] = { cuentaId: cuenta.id, bancoId: cuenta.bancoId };
    }
  }

  _subscription = NotificationReader.addNotificationListener(async (msg) => {
    const match = packageMap[msg.packageName];
    if (!match) return; // App no configurada

    const cuerpo = msg.cuerpo || msg.titulo;
    if (!esSMSBancario(msg.packageName, cuerpo)) return;

    // Usar remitente = packageName para reutilizar la lógica del parser
    const tx = parsearSMSSincrono(
      msg.packageName,
      cuerpo,
      msg.timestamp,
      match.cuentaId,
      match.bancoId,
    );

    if (!tx) return;

    try {
      // Override fuente a 'notificacion'
      await insertTransaccion({ ...tx, fuente: 'notificacion' });
      if (tx.saldoPost !== null) {
        await updateSaldoCuenta(match.cuentaId, tx.saldoPost);
      }
      onNuevoMovimiento?.(match.cuentaId, tx.monto);
    } catch (e) {
      console.warn('[NotifService] Error insertando transacción desde notificación:', e);
    }
  });
}

export function detenerEscuchaNotificaciones(): void {
  _subscription?.remove();
  _subscription = null;
}
