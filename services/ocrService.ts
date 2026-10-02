/**
 * ocrService
 * Responsabilidad: Escaneo de comprobantes con Gemini Vision
 * Usado por: scan, comprobante
 * Depende de: apiConfig
 */
import { llamarAIProxy } from '@/services/apiConfig';
import { limpiarJSON } from '@/services/jsonUtils';


export interface OcrResultado {
  monto?: number;
  descripcion: string;
  moneda?: string;
  fecha?: string;
  hora?: string;
  tipo?: 'egreso' | 'ingreso';
  banco?: string;
  error?: string;
}

function extraerJSON(texto: string): any {
  let clean = texto.trim();

  const objMatch = clean.match(/\{[\s\S]*\}/);
  if (objMatch) {
    let candidato = objMatch[0].replace(/```(?:json)?\s*\n?/gi, '').trim();
    candidato = limpiarJSON(candidato);
    try { return JSON.parse(candidato); } catch { console.warn('[Ocr] JSON parse fallback'); }
  }

  const parenMatch = clean.match(/\([\s\S]*\)/);
  if (parenMatch) {
    let candidato = parenMatch[0].replace(/```(?:json)?\s*\n?/gi, '').trim();
    candidato = candidato.replace(/^\(/, '{').replace(/\)$/, '}');
    candidato = limpiarJSON(candidato);
    try { return JSON.parse(candidato); } catch { console.warn('[Ocr] JSON parse fallback'); }
  }

  clean = clean.replace(/```(?:json)?\s*\n?/gi, '').replace(/`/g, '').trim();
  clean = limpiarJSON(clean);
  try { return JSON.parse(clean); } catch { console.warn('[Ocr] JSON parse fallback'); }

  let sinPrefijo = clean.replace(/^[^{]+/g, '');
  sinPrefijo = limpiarJSON(sinPrefijo);
  try { return JSON.parse(sinPrefijo); } catch { console.warn('[Ocr] JSON parse fallback'); }

  const objFallback = clean.match(/\{[^{}]*\}/);
  if (objFallback) {
    try { return JSON.parse(objFallback[0]); } catch { console.warn('[Ocr] JSON parse fallback'); }
  }

  return null;
}

export async function escanearComprobante(base64: string, mimeType?: string): Promise<OcrResultado> {
  const PREFILL = '{"monto":';
  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: `Analizá este comprobante financiero con máximo detalle. Leé TODOS los datos visibles: montos, fechas, horas, nombre del comercio, banco emisor y tipo de operación.

Respondé SOLO con un objeto JSON con estos campos:
- monto: número entero en guaraníes (si el monto está en otra moneda, convertilo o dejalo en la moneda original indicando la moneda)
- descripcion: nombre del comercio, servicio o concepto de la operación (sé específico: "Supermercado Stock", no solo "Supermercado")
- fecha: YYYY-MM-DD (fecha exacta del comprobante, no la de impresión si difieren)
- hora: HH:MM en formato 24h (si aparece en el comprobante, si no omitir el campo)
- tipo: "egreso" si es un pago/débito/retiro, "ingreso" si es un cobro/crédito/depósito
- banco: nombre exacto del banco o entidad emisora (ej: "Itaú", "Ueno", "Banco Continental", "Banco GNB", "Mango", "Banco Familiar", "Banco Regional", "BBVA", "Sudameris", o "Desconocido" si no se puede identificar)

Ejemplo completo: {"monto":185000,"descripcion":"Farmacia Catedral","fecha":"2026-05-29","hora":"14:32","tipo":"egreso","banco":"Itaú"}

Si hay múltiples transacciones en el comprobante, extraé la principal (la de mayor monto o la más reciente).
Nada de texto extra, solo el JSON.` },
          { inlineData: { mimeType: mimeType ?? 'image/jpeg', data: base64 } },
        ],
      },
      {
        role: 'model',
        parts: [{ text: PREFILL }],
      },
    ],
    generationConfig: { maxOutputTokens: 300 },
  };

  try {
    const resp = await llamarAIProxy(body);

    if (!resp.ok) {
      let detalle = '';
      try { const e = await resp.json(); detalle = e?.error ?? ''; } catch { console.warn('ocr: fallo al leer error de API'); }
      return { descripcion: '', error: `Error API (${resp.status})${detalle ? ': ' + detalle : ''}` };
    }

    const data = await resp.json();
    const candidates = data.candidates ?? data.result?.candidates ?? [];
    let texto = candidates[0]?.content?.parts?.[0]?.text ?? '';
    texto = PREFILL + texto;

    if (!texto) return { descripcion: '', error: 'Respuesta vacía de la IA' };

    const parsed = extraerJSON(texto);
    if (!parsed) return { descripcion: texto, error: 'No se pudo estructurar el resultado' };

    return {
      monto:       parsed.monto       ?? undefined,
      descripcion: parsed.descripcion ?? '',
      moneda:      parsed.moneda      ?? 'PYG',
      fecha:       parsed.fecha       ?? undefined,
      hora:        parsed.hora        ?? undefined,
      tipo:        parsed.tipo        ?? undefined,
      banco:       parsed.banco       ?? undefined,
    };
  } catch (e: any) {
    return { descripcion: '', error: e?.message ?? 'Error de conexión' };
  }
}
