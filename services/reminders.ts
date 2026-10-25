/**
 * reminders
 * Responsabilidad: CRUD y notificaciones de recordatorios
 * Usado por: index, recordatorios, _layout
 * Depende de: database, expo-notifications, dateKeys
 */
import { getDB } from '@/services/database';
import { Platform } from 'react-native';
import { localDateKey } from '@/services/dateKeys';

export interface Recordatorio {
  id: string;
  titulo: string;
  descripcion: string;
  fecha: string;
  repetir: 'no' | 'diario' | 'semanal' | 'mensual';
  activo: boolean;
  categoriaId: string;
  montoEstimado: number;
}

export function getRecordatorios(): Recordatorio[] {
  const db = getDB();
  try { db.execSync('CREATE TABLE IF NOT EXISTS recordatorios (id TEXT PRIMARY KEY, titulo TEXT NOT NULL, descripcion TEXT NOT NULL DEFAULT \'\', fecha TEXT NOT NULL, repetir TEXT NOT NULL DEFAULT \'no\', activo INTEGER NOT NULL DEFAULT 1, categoria_id TEXT, monto_estimado INTEGER NOT NULL DEFAULT 0)'); } catch (_) { console.warn('[Reminders] Error create table'); }
  const rows = db.getAllSync<Record<string, unknown>>(
    'SELECT * FROM recordatorios ORDER BY fecha ASC'
  );
  return rows.map(r => ({
    id: r['id'] as string,
    titulo: r['titulo'] as string,
    descripcion: r['descripcion'] as string,
    fecha: r['fecha'] as string,
    repetir: r['repetir'] as Recordatorio['repetir'],
    activo: (r['activo'] as number) === 1,
    categoriaId: (r['categoria_id'] as string) ?? '',
    montoEstimado: r['monto_estimado'] as number,
  }));
}

export async function insertRecordatorio(r: Omit<Recordatorio, 'id'>): Promise<string> {
  const db = getDB();
  try { db.execSync('CREATE TABLE IF NOT EXISTS recordatorios (id TEXT PRIMARY KEY, titulo TEXT NOT NULL, descripcion TEXT NOT NULL DEFAULT \'\', fecha TEXT NOT NULL, repetir TEXT NOT NULL DEFAULT \'no\', activo INTEGER NOT NULL DEFAULT 1, categoria_id TEXT, monto_estimado INTEGER NOT NULL DEFAULT 0)'); } catch (_) { console.warn('[Reminders] Error create table'); }
  const id = `rem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  db.runSync(
    `INSERT INTO recordatorios (id, titulo, descripcion, fecha, repetir, activo, categoria_id, monto_estimado)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, r.titulo, r.descripcion, r.fecha, r.repetir, r.activo ? 1 : 0, r.categoriaId, r.montoEstimado]
  );
  await programarNotificacion(id, r.titulo, r.descripcion, r.fecha, r.repetir);
  return id;
}

export async function deleteRecordatorio(id: string): Promise<void> {
  getDB().runSync('DELETE FROM recordatorios WHERE id = ?', [id]);
  try {
    const Notifications = await import('expo-notifications');
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch (e) {
    console.warn('[Reminders] Error cancelando notificación:', e);
  }
}

export async function toggleRecordatorio(id: string, activo: boolean): Promise<void> {
  getDB().runSync('UPDATE recordatorios SET activo = ? WHERE id = ?', [activo ? 1 : 0, id]);
  if (!activo) {
    try {
      const Notifications = await import('expo-notifications');
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch (e) {
      console.warn('[Reminders] Error cancelando notificación:', e);
    }
  }
}

async function programarNotificacion(id: string, titulo: string, descripcion: string, fecha: string, repetir: string) {
  const fechaDate = new Date(fecha);
  if (isNaN(fechaDate.getTime())) return;

  try {
    const Notifications = await import('expo-notifications');

    const trigger = {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: fechaDate,
      channelId: 'payment-reminders',
    };

    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: {
        title: titulo,
        body: 'Tenés un vencimiento próximo. Abrí la app para verlo.',
        data: { tipo: 'recordatorio', id },
      },
      trigger,
    });
  } catch (e) {
    console.warn('[Reminders] Error programando notificación:', e);
  }
}

export function getRecordatorioProximo(): Recordatorio | null {
  const db = getDB();
  try {
    const plus3 = new Date();
    plus3.setDate(plus3.getDate() + 3);
    const rows = db.getAllSync<Record<string, unknown>>(
      `SELECT * FROM recordatorios WHERE activo = 1 AND fecha <= ? ORDER BY fecha ASC LIMIT 1`,
      [localDateKey(plus3)]
    );
    if (!rows.length) return null;
    const r = rows[0];
    return {
      id: r['id'] as string,
      titulo: r['titulo'] as string,
      descripcion: r['descripcion'] as string,
      fecha: r['fecha'] as string,
      repetir: r['repetir'] as Recordatorio['repetir'],
      activo: (r['activo'] as number) === 1,
      categoriaId: (r['categoria_id'] as string) ?? '',
      montoEstimado: r['monto_estimado'] as number,
    };
  } catch {
    return null;
  }
}

export async function initReminderChannel() {
  if (Platform.OS === 'android') {
    try {
      const Notifications = await import('expo-notifications');
      await Notifications.setNotificationChannelAsync('payment-reminders', {
        name: 'Recordatorios de pagos',
        importance: Notifications.AndroidImportance.HIGH,
      });
    } catch (e) {
      console.warn('[Reminders] Error creando canal de notificaciones:', e);
    }
  }
}
