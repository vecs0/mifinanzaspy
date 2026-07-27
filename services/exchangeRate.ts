/**
 * exchangeRate
 * Responsabilidad: Cotización USD desde API del BCP
 * Usado por: (ningún import directo)
 * Depende de: (ninguna, standalone)
 */
const CACHE_KEY = 'cotizacion_usd_cache';
const API_URL = 'https://api.bcp.gov.py/cex/v1/cotizacion';

export interface CotizacionUSD {
  compra: number;
  venta: number;
  fecha: string;
}

export async function obtenerCotizacion(): Promise<CotizacionUSD> {
  try {
    const res = await fetch(`${API_URL}/usd`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const cotizacion: CotizacionUSD = {
      compra: parseFloat(data.compra) || 0,
      venta: parseFloat(data.venta) || 0,
      fecha: data.fecha ?? new Date().toISOString(),
    };
    return cotizacion;
  } catch {
    const { getConfig, setConfig } = await import('@/services/database');
    const cached = await getConfig(CACHE_KEY);
    if (cached) return JSON.parse(cached);
    return { compra: 0, venta: 0, fecha: '' };
  }
}

export async function guardarCotizacion(c: CotizacionUSD): Promise<void> {
  const { setConfig } = await import('@/services/database');
  await setConfig(CACHE_KEY, JSON.stringify(c));
}
