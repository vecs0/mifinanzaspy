/**
 * geminiDirect
 * Responsabilidad: Llamada directa a Gemini API sin proxy
 * Usado por: batchImportService, importService
 * Depende de: expo-constants
 */
import Constants from 'expo-constants';

const GEMINI_KEY: string =
  (Constants.expoConfig?.extra?.geminiApiKey as string) ??
  process.env.EXPO_PUBLIC_GEMINI_API_KEY ??
  '';

const BASE_URL: string =
  (Constants.expoConfig?.extra?.geminiBaseUrl as string) ||
  'https://generativelanguage.googleapis.com/v1beta/models';

const TIMEOUT_MS = 30_000;
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

export async function llamarGeminiDirecto(
  model: string,
  body: object,
  retries = 4,
): Promise<Response> {
  const url = `${BASE_URL}/${model}:generateContent`;

  let lastResponse: Response | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!RETRYABLE.has(resp.status)) return resp;

      lastResponse = resp;

      if (attempt === retries) break;

      const retryAfter = resp.headers.get('Retry-After');
      const waitMs = retryAfter
        ? parseInt(retryAfter, 10) * 1000
        : Math.min(1000 * Math.pow(2, attempt), 32000);

      if (__DEV__) console.log(
        `[GeminiDirect] ${resp.status} en intento ${attempt + 1}/${retries + 1}. ` +
        `Reintentando en ${waitMs / 1000}s…`,
      );

      await sleep(waitMs);
    } catch (networkErr) {
      clearTimeout(timeout);
      if (attempt === retries) throw networkErr;
      const waitMs = Math.min(1000 * Math.pow(2, attempt), 16000);
      if (__DEV__) console.log(`[GeminiDirect] Error de red, reintentando en ${waitMs / 1000}s…`);
      await sleep(waitMs);
    }
  }

  return lastResponse!;
}
