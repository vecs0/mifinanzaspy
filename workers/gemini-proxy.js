/**
 * Gemini Proxy Worker — Cloudflare Workers
 *
 * Deploy: copiá este código en https://dash.cloudflare.com → Workers & Pages → Create Worker
 * Seteá la variable de entorno GEMINI_API_KEY con tu key de Gemini
 *
 * Uso desde la app:
 *   POST https://tu-worker.nombre.workers.dev
 *   Body: { model, endpoint, body }
 *
 *   model    — ej: "gemini-2.5-flash"
 *   endpoint — "v1beta" (default)
 *   body     — el payload completo de Gemini
 */

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Solo POST' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const GEMINI_API_KEY = env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: 'Falta GEMINI_API_KEY en env' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'JSON inválido' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const model = payload.model || 'gemini-2.5-flash';
    const endpoint = payload.endpoint || 'v1beta';
    const geminiBody = payload.body;

    if (!geminiBody) {
      return new Response(JSON.stringify({ error: 'Falta body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const url = `https://generativelanguage.googleapis.com/${endpoint}/models/${model}:generateContent`;

    try {
      const geminiResp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': GEMINI_API_KEY,
        },
        body: JSON.stringify(geminiBody),
      });

      if (!geminiResp.ok) {
        const errText = await geminiResp.text().catch(() => '(sin detalle)');
        return new Response(JSON.stringify({
          error: `Gemini API error (${geminiResp.status})`,
          detalle: errText.slice(0, 500),
        }), {
          status: geminiResp.status,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }

      const data = await geminiResp.json();
      return new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }
  },
};
