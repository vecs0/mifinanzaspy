// modules/sms-reader/src/index.ts — Re-exporta la API pública del módulo
export {
  solicitarPermisosLectura,
  getEstadoPermisos,
  leerHistorialSMS,
  leerSMSBancarios,
  addSmsListener,
} from './SmsReaderModule';
export type { SmsMessage, SmsPermissionStatus } from './SmsReaderModule';
