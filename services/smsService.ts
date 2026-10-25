/**
 * smsService
 * Responsabilidad: Puente entre SmsReader nativo y la DB
 * Usado por: _layout, onboarding/permisos
 * Depende de: smsParser, database, banks
 * Android-only: SmsReader no-op en iOS/web
 * Permisos: PermissionsAndroid de RN en lugar del módulo nativo
 */
import { Platform } from 'react-native';
import { esSMSBancario, parsearSMS } from './smsParser';
import { insertTransaccion, getCuentas, updateSaldoCuenta, insertarNotificacion } from './database';
import { BANKS } from '@/constants/banks';


let SmsReader: typeof import('../modules/sms-reader/src') | null = null;
if (Platform.OS === 'android') {
  try {
    SmsReader = require('../modules/sms-reader/src');
  } catch {
    console.warn('[SmsService] Módulo nativo SmsReader no disponible (modo Expo Go o iOS).');
  }
}



/**
 * Lee los últimos SMS bancarios del inbox y los inserta en la DB.
 * Devuelve cuántos se importaron nuevos.
 */
export async function importarHistorialSMS(): Promise<number> {
  if (!SmsReader) return 0;

  let permisos: { leer: boolean; recibir: boolean };
  try {
    permisos = await SmsReader.getEstadoPermisos();
  } catch (e) {
    console.warn('[SmsService] Error obteniendo permisos:', e);
    permisos = { leer: false, recibir: false };
  }
  if (!permisos.leer) return 0;

  const cuentas = await getCuentas();
  const bancoIds = [...new Set(cuentas.map(c => c.bancoId))];
  const remitentes = bancoIds.flatMap(id => {
    const banco = BANKS.find(b => b.id === id);
    return banco?.remitentes ?? [];
  });

  let mensajes: { remitente: string; cuerpo: string; timestamp: number }[];
  try {
    mensajes = await SmsReader.leerSMSBancarios(remitentes, 200);
  } catch (e) {
    console.warn('[SmsService] Error leyendo SMS bancarios:', e);
    mensajes = [];
  }
  let importados = 0;

  for (const msg of mensajes) {
    if (!esSMSBancario(msg.remitente, msg.cuerpo)) continue;
    try {
      const resultado = await parsearSMS(msg.remitente, msg.cuerpo, msg.timestamp);
      if (resultado.transaccion && resultado.cuentaId) {
        await insertTransaccion(resultado.transaccion);
        importados++;
        if (resultado.transaccion.saldoPost !== null) {
          await updateSaldoCuenta(resultado.cuentaId, resultado.transaccion.saldoPost);
        }
      }
    } catch (e) {
      console.warn('[SmsService] Error parseando SMS:', e);
    }
  }

  if (importados > 0) {
    const titulo = `Se importaron ${importados} movimiento${importados !== 1 ? 's' : ''}`;
    const cuerpo = `Revisá tus transacciones importadas desde SMS.`;
    insertarNotificacion(titulo, cuerpo, 'info');
    try {
      const Notifications = await import('expo-notifications');
      await Notifications.scheduleNotificationAsync({
        content: { title: titulo, body: cuerpo, data: { screen: 'notificaciones' }, sound: true },
        trigger: null,
      });
        } catch { console.warn('[SmsService] Error en operación'); }
  }

  return importados;
}



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

  try {
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
        const desc = resultado.transaccion.descripcion || 'Movimiento registrado';
        const montoStr = `${Math.abs(resultado.transaccion.monto).toLocaleString('es-PY')} Gs`;
        insertarNotificacion('Nuevo movimiento registrado',
          `${desc} — ${montoStr}`, 'alerta');
        try {
          const Notifications = await import('expo-notifications');
          await Notifications.scheduleNotificationAsync({
            content: {
              title: 'Nuevo movimiento registrado',
              body: 'Abrí la app para verlo.',
              data: { screen: 'notificaciones' },
              sound: true,
            },
            trigger: null,
          });
        } catch { console.warn('[SmsService] Error en operación'); }
      }
    } catch (e) {
      console.warn('[SmsService] Error procesando SMS entrante:', e);
    }
  });
  } catch (e) {
    console.warn('[SmsService] Error registrando listener SMS:', e);
    _smsSubscription = { remove: () => {} };
  }
}

/**
 * Detiene la escucha de SMS.
 */
export function detenerEscuchaSMS(): void {
  _smsSubscription?.remove();
  _smsSubscription = null;
}


import { PermissionsAndroid } from 'react-native';

export async function solicitarPermisosLecturaSMS(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    const results = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.READ_SMS,
      PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
    ]);
    const readGranted = results[PermissionsAndroid.PERMISSIONS.READ_SMS] === PermissionsAndroid.RESULTS.GRANTED;
    const receiveGranted = results[PermissionsAndroid.PERMISSIONS.RECEIVE_SMS] === PermissionsAndroid.RESULTS.GRANTED;
    return readGranted && receiveGranted;
  } catch {
    return false;
  }
}

export async function getPermisosLecturaSMS(): Promise<{ leer: boolean; recibir: boolean }> {
  if (Platform.OS !== 'android') return { leer: true, recibir: true };
  try {
    const leer = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_SMS);
    const recibir = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECEIVE_SMS);
    return { leer, recibir };
  } catch {
    return { leer: false, recibir: false };
  }
}
