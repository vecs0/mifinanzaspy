/**
 * Gemini Proxy Worker - Cloudflare Workers
 * Secrets: GEMINI_API_KEY (obligatorio), APP_TOKEN (opcional)
 * Vars: GEMINI_MODEL, ALLOWED_ORIGIN, RATE_LIMIT_PER_MIN
 * Request: POST { body } con header x-app-token si APP_TOKEN esta definido
 */

const MAX_BODY_BYTES = 12 * 1024 * 1024;
const DEFAULT_MODEL = 'gemini-2.5-flash';
const hits = new Map();

function cors(env) {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-app-token',
  };
}

function json(env, status, obj) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors(env) },
  });
}

function limited(env, ip) {
  const max = parseInt(env.RATE_LIMIT_PER_MIN || '30', 10);
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter(t => now - t < 60000);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > max;
}

function tokenOk(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors(env) });
    if (request.method !== 'POST') return json(env, 405, { error: 'Solo POST' });
    if (!env.GEMINI_API_KEY) return json(env, 500, { error: 'Servidor no configurado' });

    if (env.APP_TOKEN) {
      const sent = request.headers.get('x-app-token') || '';
      if (!tokenOk(sent, env.APP_TOKEN)) return json(env, 401, { error: 'No autorizado' });
    }

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (limited(env, ip)) return json(env, 429, { error: 'Demasiadas solicitudes' });

    const len = parseInt(request.headers.get('Content-Length') || '0', 10);
    if (len > MAX_BODY_BYTES) return json(env, 413, { error: 'Cuerpo demasiado grande' });

    let text;
    try {
      text = await request.text();
    } catch {
      return json(env, 400, { error: 'Solicitud invalida' });
    }
    if (text.length > MAX_BODY_BYTES) return json(env, 413, { error: 'Cuerpo demasiado grande' });

    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      return json(env, 400, { error: 'JSON invalido' });
    }

    const geminiBody = payload && payload.body;
    if (!geminiBody || typeof geminiBody !== 'object' || !Array.isArray(geminiBody.contents)) {
      return json(env, 400, { error: 'Falta body.contents' });
    }

    const model = env.GEMINI_MODEL || DEFAULT_MODEL;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
        body: JSON.stringify(geminiBody),
      });
      if (!resp.ok) {
        const errText = await resp.text().catch(() => '');
        return json(env, resp.status, {
          error: `Gemini API error (${resp.status})`,
          detalle: errText.slice(0, 300),
        });
      }
      return json(env, 200, await resp.json());
    } catch {
      return json(env, 502, { error: 'Error al contactar Gemini' });
    }
  },
};
