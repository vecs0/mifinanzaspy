/**
 * +native-intent
 * Responsabilidad: Evita que los deep links de captura (mifinanzaspy://registrar) naveguen a una ruta inexistente
 * Usado por: expo-router (intents nativos)
 * Depende de: (ninguna, standalone)
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    if (/(^|\/)registrar(\/|\?|$)/i.test(path)) return '/';
  } catch {
    return '/';
  }
  return path;
}
