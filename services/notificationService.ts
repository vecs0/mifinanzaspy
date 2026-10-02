/**
 * notificationService
 * Responsabilidad: Conecta NotificationReader nativo con la DB
 * Usado por: _layout, onboarding/permisos
 * Depende de: database, smsParser, banks
 */
import { Platform } from 'react-native';
import { parsearSMSSincrono, esSMSBancario } from './smsParser';
import { insertTransaccion, updateSaldoCuenta, getCuentas, insertarNotificacion } from './database';

let NotificationReader: typeof import('../modules/notification-reader/src') | null = null;
if (Platform.OS === 'android') {
  try {
    NotificationReader = require('../modules/notification-reader/src');
  } catch {
    console.warn('[NotifService] Módulo NotificationReader no disponible.');
  }
}


let _subscription: { remove: () => void } | null = null;



export async function isAccesoNotificacionesHabilitado(): Promise<boolean> {
  if (!NotificationReader) return false;
  try {
    return await NotificationReader.isAccesoHabilitado();
  } catch (e) {
    console.warn('[NotifService] Error verificando acceso notificaciones:', e);
    return false;
  }
}

export async function abrirAjustesNotificaciones(): Promise<void> {
  if (!NotificationReader) {
    console.warn('[NotifService] Modulo nativo no disponible');
    return;
  }
  try {
    await NotificationReader.abrirAjustesAcceso();
  } catch (e) {
    console.warn('[NotifService] Error abriendo ajustes de notificaciones:', e);
  }
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

  let habilitado: boolean;
  try {
    habilitado = await NotificationReader.isAccesoHabilitado();
  } catch (e) {
    console.warn('[NotifService] Error verificando acceso:', e);
    return;
  }
  if (!habilitado) return;

  const cuentas = await getCuentas();
  const packageMap: Record<string, { cuentaId: string; bancoId: string }> = {};
  for (const cuenta of cuentas) {
    if (cuenta.notifHabilitada && cuenta.activa) {
      packageMap[cuenta.appPackage] = { cuentaId: cuenta.id, bancoId: cuenta.bancoId };
    }
  }

  try {
    _subscription = NotificationReader.addNotificationListener(async (msg) => {
    const match = packageMap[msg.packageName];
    if (!match) return;

    const cuerpo = msg.cuerpo || msg.titulo;
    if (!esSMSBancario(msg.packageName, cuerpo)) return;

    const tx = parsearSMSSincrono(
      msg.packageName,
      cuerpo,
      msg.timestamp,
      match.cuentaId,
      match.bancoId,
    );

    if (!tx) return;

    try {
      await insertTransaccion({ ...tx, fuente: 'notificacion' });
      if (tx.saldoPost !== null) {
        await updateSaldoCuenta(match.cuentaId, tx.saldoPost);
      }
      onNuevoMovimiento?.(match.cuentaId, tx.monto);
      const desc = tx.descripcion || 'Movimiento registrado';
      const montoStr = `${Math.abs(tx.monto).toLocaleString('es-PY')} Gs`;
      insertarNotificacion('Nuevo movimiento registrado',
        `${desc} — ${montoStr}`, 'alerta');
      try {
        const Notifications = await import('expo-notifications');
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Nuevo movimiento registrado',
            body: `${desc} — ${montoStr}`,
            data: { screen: 'notificaciones' },
            sound: true,
          },
          trigger: null,
        });
      } catch { console.warn('[NotifService] Error programando notificación local'); }
    } catch (e) {
      console.warn('[NotifService] Error insertando transacción desde notificación:', e);
    }
  });
  } catch (e) {
    console.warn('[NotifService] Error registrando listener de notificaciones:', e);
    _subscription = { remove: () => {} };
  }
}

export function detenerEscuchaNotificaciones(): void {
  try {
    _subscription?.remove();
  } catch (e) {
    console.warn('[NotifService] Error al detener escucha:', e);
  }
  _subscription = null;
}



export async function programarRecordatorioDiario(): Promise<void> {
  try {
    const {
      scheduleNotificationAsync, getAllScheduledNotificationsAsync,
      SchedulableTriggerInputTypes,
    } = await import('expo-notifications');
    const existing = await getAllScheduledNotificationsAsync();
    const yaProgramado = existing.some(n => n.content.title === 'MiFinanzasPY' && n.content.body === '¿Registraste tus gastos de hoy?');
    if (yaProgramado) return;
    await scheduleNotificationAsync({
      content: {
        title: 'MiFinanzasPY',
        body: '¿Registraste tus gastos de hoy?',
        sound: true,
      },
      trigger: {
        type: SchedulableTriggerInputTypes.DAILY,
        hour: 20,
        minute: 0,
      },
    });
  } catch { console.warn('[NotifService] Error programando recordatorio diario'); }
}

export async function programarReporteSemanal(): Promise<void> {
  try {
    const {
      scheduleNotificationAsync, cancelAllScheduledNotificationsAsync,
      SchedulableTriggerInputTypes,
    } = await import('expo-notifications');

    await scheduleNotificationAsync({
      content: {
        title: '📊 Resumen semanal MiFinanzasPY',
        body: 'Tu reporte de la semana ya está listo. Abrí la app para verlo.',
        data: { tipo: 'reporte_semanal', screen: '/(tabs)/reportes' },
        sound: true,
      },
      trigger: {
        type: SchedulableTriggerInputTypes.WEEKLY,
        weekday: 1,
        hour: 10,
        minute: 0,
      },
    });
  } catch { console.warn('[NotifService] Error programando reporte semanal'); }
}
