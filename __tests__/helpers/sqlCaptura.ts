/**
 * sqlCaptura
 * Responsabilidad: Doble minimo de expo-sqlite que registra el SQL recibido y devuelve las filas configuradas
 * Usado por: __tests__/consumidoresArchivado.test.ts
 * Depende de: ninguno
 */
export const captura: { sentencias: string[]; filas: unknown[]; primera: unknown } = {
  sentencias: [],
  filas: [],
  primera: null,
};

export function reiniciarCaptura(): void {
  captura.sentencias = [];
  captura.filas = [];
  captura.primera = null;
}

const db = {
  execSync: (_sql: string): void => {},
  getAllSync: <T>(sql: string): T[] => {
    captura.sentencias.push(sql);
    return captura.filas as T[];
  },
  getFirstSync: <T>(_sql: string): T | null => captura.primera as T | null,
  runSync: (_sql: string): { changes: number } => ({ changes: 0 }),
  withTransactionSync: <T>(fn: () => T): T => fn(),
};

export default db;
