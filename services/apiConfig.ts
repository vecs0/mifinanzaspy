/**
 * apiConfig
 * Responsabilidad: Cliente del proxy Gemini (Cloudflare Worker). Nunca llama a Gemini directo.
 * Usado por: batchImportService, importService, ocrService, chat
 * Depende de: expo-constants
 */
import Constants from 'expo-constants';

const WORKER_URL: string = (Constants.expoConfig?.extra?.workerUrl as string) || '';
const APP_TOKEN: string = (Constants.expoConfig?.extra?.workerAppToken as string) || '';

const TIMEOUT_MS = 30_000;
const RETRYABLE = new Set([429, 500, 502, 503, 504]);
const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

export async function llamarAIProxy(body: any, retries = 3): Promise<Response> {
  if (!WORKER_URL) throw new Error('EXPO_PUBLIC_WORKER_URL no configurada');
  let last: Response | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (APP_TOKEN) headers['x-app-token'] = APP_TOKEN;
      const resp = await fetch(WORKER_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({ body }),
        signal: controller.signal,
      });
      if (!RETRYABLE.has(resp.status) || attempt === retries) return resp;
      last = resp;
    } catch (e) {
      if (attempt === retries) throw e;
    } finally {
      clearTimeout(timeout);
    }
    await sleep(Math.min(1000 * Math.pow(2, attempt), 8000));
  }
  return last!;
}
