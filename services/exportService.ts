/**
 * exportService
 * Responsabilidad: Exportación de transacciones a CSV
 * Usado por: (ningún import directo)
 * Depende de: database, expo-sharing, expo-file-system
 */
import { getDB } from '@/services/database';

export async function exportarCSV(): Promise<string> {
  let File: any, Paths: any;
  try {
    const mod = await import('expo-file-system');
    File = mod.File;
    Paths = mod.Paths;
  } catch (e) {
    console.warn('[Export] Error importando expo-file-system:', e);
    throw new Error('Módulo de sistema de archivos no disponible');
  }

  const rows = getDB().getAllSync<Record<string, unknown>>(
    `SELECT t.id, t.fecha, t.monto, t.tipo, t.descripcion, t.categoria_id,
            c.banco_nombre, c.alias AS cuenta_alias
     FROM transacciones t
     JOIN cuentas c ON c.id = t.cuenta_id
     ORDER BY t.fecha DESC`
  );

  const header = 'ID,Fecha,Monto,Tipo,Descripcion,Categoria,Banco,Cuenta\n';
  const csv = header + rows.map(r =>
    [
      r['id'], r['fecha'], r['monto'], r['tipo'],
      `"${(r['descripcion'] as string ?? '').replace(/"/g, '""')}"`,
      r['categoria_id'], r['banco_nombre'], r['cuenta_alias'],
    ].join(',')
  ).join('\n');

  try {
    const file = new File(Paths.cache, `finanzas_export_${Date.now()}.csv`);
    file.write(csv);
    return file.uri;
  } catch (e) {
    console.warn('[Export] Error escribiendo archivo CSV:', e);
    throw new Error('Error al exportar CSV');
  }
}

export async function compartirCSV(): Promise<void> {
  let Sharing: any;
  try {
    Sharing = await import('expo-sharing');
  } catch (e) {
    console.warn('[Export] Error importando expo-sharing:', e);
    return;
  }

  try {
    if (!await Sharing.isAvailableAsync()) {
      console.warn('[Export] Sharing no disponible');
      return;
    }
    const path = await exportarCSV();
    await Sharing.shareAsync(path, { mimeType: 'text/csv' });
  } catch (e) {
    console.warn('[Export] Error compartiendo CSV:', e);
  }
}
