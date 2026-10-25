/**
 * validation
 * Responsabilidad: Validación de monto, descripción, fecha y nombre
 * Usado por: importar
 * Depende de: dateKeys
 */
import { localDateKey } from '@/services/dateKeys';

const MAX_MONTO = 100_000_000;
const MAX_DESC = 200;
const MAX_NOMBRE = 60;

export function validarMonto(raw: string): number | null {
  const n = parseInt(raw.replace(/[^\d-]/g, ''), 10);
  if (isNaN(n) || n === 0 || Math.abs(n) > MAX_MONTO) return null;
  return n;
}

export function validarDescripcion(raw: string): string {
  return raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').slice(0, MAX_DESC);
}

export function validarNombre(raw: string): string {
  return raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').trim().slice(0, MAX_NOMBRE);
}

export function validarFecha(raw: unknown): string {
  if (typeof raw !== 'string') return localDateKey();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return localDateKey();
  const y = match[1], m = match[2], d = match[3];
  return `${y}-${m}-${d}`;
}
