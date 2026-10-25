/**
 * apiConfig
 * Responsabilidad: Cliente del proxy Gemini (Cloudflare Worker). Nunca llama a Gemini directo.
 * Usado por: batchImportService, importService, nlCapture, ocrService, chat
 * Depende de: expo-constants
 */
import Constants from 'expo-constants';

const WORKER_URL: string = (Constants.expoConfig?.extra?.workerUrl as string) || '';
const APP_TOKEN: string = (Constants.expoConfig?.extra?.workerAppToken as string) || '';

const TIMEOUT_MS = 30_000;
const REINTENTOS_POR_DEFECTO = 3;
const RETRYABLE = new Set([429, 500, 502, 503, 504]);
const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

export class WorkerNoConfiguradoError extends Error {
  constructor() {
    super('El asistente de IA no está configurado en esta instalación.');
    this.name = 'WorkerNoConfiguradoError';
  }
}

export function workerConfigurado(): boolean {
  return Boolean(WORKER_URL);
}

export async function llamarAIProxy(
  body: unknown,
  opciones?: { reintentos?: number; timeoutMs?: number },
): Promise<Response> {
  if (!WORKER_URL) throw new WorkerNoConfiguradoError();
  const reintentos = opciones?.reintentos ?? REINTENTOS_POR_DEFECTO;
  const timeoutMs = opciones?.timeoutMs ?? TIMEOUT_MS;
  let last: Response | null = null;
  for (let attempt = 0; attempt <= reintentos; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (APP_TOKEN) headers['x-app-token'] = APP_TOKEN;
      const resp = await fetch(WORKER_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({ body }),
        signal: controller.signal,
      });
      if (!RETRYABLE.has(resp.status) || attempt === reintentos) return resp;
      last = resp;
    } catch (e) {
      if (attempt === reintentos) throw e;
    } finally {
      clearTimeout(timeout);
    }
    await sleep(Math.min(1000 * Math.pow(2, attempt), 8000));
  }
  return last!;
}
