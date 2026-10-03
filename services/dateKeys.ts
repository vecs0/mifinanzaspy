/**
 * dateKeys
 * Responsabilidad: Helpers puros de fechas locales (clave YYYY-MM-DD y rango del dia en ISO UTC)
 * Usado por: app/(tabs)/index.tsx
 * Depende de: ninguno
 */
export function localDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function localDayRange(d: Date = new Date()): { desde: string; hasta: string } {
  const ini = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const fin = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  return { desde: ini.toISOString(), hasta: fin.toISOString() };
}
