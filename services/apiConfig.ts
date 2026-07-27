/**
 * apiConfig
 * Responsabilidad: Configuración de APIs externas y proxy Gemini
 * Usado por: batchImportService, importService, ocrService, chat
 * Depende de: expo-constants
 */
import Constants from 'expo-constants';

const WORKER_URL: string =
  (Constants.expoConfig?.extra?.workerUrl as string) ||
  'https://tu-worker.example.workers.dev';

const TIMEOUT_MS = 30_000;

export function llamarAIProxy(model: string, body: any, endpoint = 'v1beta') {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  return fetch(WORKER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, endpoint, body }),
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout));
}
