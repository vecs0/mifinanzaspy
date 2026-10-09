/**
 * dateKeys
 * Responsabilidad: Helpers puros de fechas locales (clave de dia, clave de mes, ventana de N dias, dia de fecha guardada y rango del dia en ISO UTC)
 * Usado por: app/(tabs)/index.tsx, services/database.ts, services/totales.ts, __tests__/dateKeys.test.ts
 * Depende de: ninguno
 */
export function localDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function localMonthKey(ref: Date): string {
  const y = ref.getFullYear();
  const m = String(ref.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function localLastDaysKeys(ref: Date, dias: number): string[] {
  const keys: string[] = [];
  for (let i = dias - 1; i >= 0; i--) {
    keys.push(localDateKey(new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - i)));
  }
  return keys;
}

export function storedDayKey(fecha: string): string {
  return fecha.slice(0, 10);
}

export function localDayRange(d: Date = new Date()): { desde: string; hasta: string } {
  const ini = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const fin = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  return { desde: ini.toISOString(), hasta: fin.toISOString() };
}
