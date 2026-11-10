import { SMS_HABILITADO } from '@/constants/features';
import { getPermisosLecturaSMS, importarHistorialSMS } from '@/services/smsService';
import appJson from '../app.json';

describe('SMS deshabilitado en la v1', () => {
  it('el flag SMS_HABILITADO está apagado', () => {
    expect(SMS_HABILITADO).toBe(false);
  });

  it('app.json no declara READ_SMS ni RECEIVE_SMS', () => {
    const permisos: string[] = appJson.expo.android.permissions;
    expect(permisos).not.toContain('READ_SMS');
    expect(permisos).not.toContain('RECEIVE_SMS');
  });

  it('app.json conserva los permisos necesarios', () => {
    const permisos: string[] = appJson.expo.android.permissions;
    expect(permisos).toContain('POST_NOTIFICATIONS');
    expect(permisos).toContain('INTERNET');
  });

  it('getPermisosLecturaSMS devuelve denegado sin consultar el sistema', async () => {
    await expect(getPermisosLecturaSMS()).resolves.toEqual({ leer: false, recibir: false });
  });

  it('importarHistorialSMS no importa movimientos', async () => {
    await expect(importarHistorialSMS()).resolves.toBe(0);
  });
});
