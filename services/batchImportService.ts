/**
 * batchImportService
 * Responsabilidad: Importación masiva de comprobantes con IA
 * Usado por: components/comprobante/BatchPickerScreen
 * Depende de: apiConfig, importService
 */
import { llamarAIProxy } from '@/services/apiConfig';
import type { PreviewItem } from '@/services/importService';


function limpiarJSON(texto: string): string {
  return texto
    .replace(/"\s*\.\s*/g, '":"')
    .replace(/\.\s*:/g, ':')
    .replace(/"\s*"/g, '","')
    .replace(/\(\s*/g, '{')
    .replace(/\)\s*\]/g, '}]')
    .replace(/\)\s*[,\s]*/g, '},')
    .replace(/\)\s*$/g, '}')
    .replace(/'/g, '"')
    .replace(/,(\s*[}\]])/g, '$1')
    .replace(/,\s*$/, '');
}

function findClose(src: string, from: number): number {
  let depth = 0, inStr = false, escape = false;
  for (let i = from; i < src.length; i++) {
    const ch = src[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\') { escape = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === '[' || ch === '{') { depth++; continue; }
    if (ch === ']' || ch === '}') { if (--depth === 0) return i; }
  }
  return -1;
}

function extractElements(src: string, arrayStart: number): any[] {
  const items: any[] = [];
  let pos = arrayStart + 1;
  while (pos < src.length) {
    while (pos < src.length && src[pos] !== '{' && src[pos] !== '[') {
      if (src[pos] === ']' && items.length > 0) return items;
      pos++;
    }
    if (pos >= src.length) break;
    const closeIdx = findClose(src, pos);
    if (closeIdx === -1) break;
    try { items.push(JSON.parse(src.slice(pos, closeIdx + 1))); } catch { console.warn('[BatchImport] Error'); }
    pos = closeIdx + 1;
  }
  return items;
}

function extraerJSONArray(texto: string): any[] | null {
  for (const src of [texto.trim(), limpiarJSON(texto.trim())]) {
    const start = src.indexOf('[');
    if (start === -1) continue;
    const close = findClose(src, start);
    const target = close !== -1 ? src.slice(start, close + 1) : src.slice(start);
    try {
      const p = JSON.parse(close !== -1 ? target : target + ']');
      if (Array.isArray(p) && p.length > 0) return p;
    } catch { console.warn('[BatchImport] Error'); }
    const elems = extractElements(src, start);
    if (elems.length > 0) return elems;
  }
  return null;
}

function normalizeItem(p: any): PreviewItem | null {
  let monto: number, descripcion: string, fecha: string;

  if (Array.isArray(p)) {
    if (p.length < 3) return null;
    fecha = String(p[0] ?? '').slice(0, 10);
    descripcion = String(p[1] ?? '');
    monto = typeof p[2] === 'string' ? parseInt(p[2], 10) : Number(p[2]);
  } else if (p && typeof p === 'object') {
    if (p.banco) return null;
    monto = typeof p.monto === 'string' ? parseInt(p.monto, 10) : Number(p.monto);
    descripcion = String(p.descripcion ?? p.description ?? '');
    fecha = String(p.fecha ?? p.date ?? '').slice(0, 10);
  } else {
    return null;
  }

  if (isNaN(monto) || monto === 0) return null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    fecha = new Date().toISOString().slice(0, 10);
  }

  return {
    monto,
    tipo: monto < 0 ? 'debito' : 'credito',
    descripcion: descripcion.trim(),
    fecha: `${fecha}T12:00:00`,
    categoriaId: 'otros',
    contraparteBancoId: Array.isArray(p) ? (p[3] != null ? String(p[3]) : null) : (p.contraparte_banco_id ?? p.contraparteBancoId ?? null),
    contraparteNombre: Array.isArray(p) ? (p[4] != null ? String(p[4]) : null) : (p.contraparte_nombre ?? p.contraparteNombre ?? null),
  };
}

function deduplicar(items: PreviewItem[]): PreviewItem[] {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = `${item.fecha}|${item.monto}|${item.descripcion}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const PROMPT_IMAGEN = `Analizá este comprobante o imagen financiera.

Respondé SOLO con un array JSON. Sin texto extra. Sin markdown.
Formato de cada elemento: {"monto":numero,"descripcion":"texto","fecha":"YYYY-MM-DD"}

Reglas:
- monto positivo = ingreso, negativo = egreso
- Extraé TODAS las transacciones visibles
- Si no hay datos, devolvé []

Ejemplo: [{"monto":-50000,"descripcion":"Supermercado","fecha":"2026-05-29"}]`;

const PROMPT_PDF = `EXTRACTO BANCARIO — extraé ABSOLUTAMENTE TODAS las transacciones, sin omitir ninguna.

Identificá el banco (Itaú, Ueno, Continental, Familiar, Regional, Mango, etc).

Respondé SOLO con un array JSON. Sin texto, sin markdown, sin bloques de código.
El PRIMER elemento es metadata: {"banco":"NombreDelBanco","total":N}
Los siguientes son transacciones en formato de 5 elementos:
["YYYY-MM-DD","descripcion completa",monto,"banco_contraparte_o_null","nombre_contraparte_o_null"]

Reglas CRÍTICAS:
- monto: positivo=ingreso, negativo=egreso. Solo números enteros, sin puntos ni comas
- Fecha: convertir DD/MM/AAAA → YYYY-MM-DD
- Campo [3] Banco contraparte: si la descripción menciona un banco, poner su ID (itau, ueno, continental, etc). Si no → null
- Campo [4] Nombre contraparte: si hay nombre de persona o empresa en la descripción → extraerlo. Si no → null
- NO incluyas saldo, encabezados, totales ni notas
- Array vacío [] si no hay datos

EJEMPLO:
[{"banco":"Ueno","total":3},["2026-05-12","Tigo Pago Facturas",-97000,null,null],["2026-05-12","Transferencia Recibida de Clara Sosa",97000,"itau","Clara Sosa"]]`;

async function analizarUnaImagen(
  base64: string,
  mimeType: string,
  index: number,
): Promise<{ items: PreviewItem[]; error?: string; index: number }> {
  try {
    const resp = await llamarAIProxy({
      contents: [{
        role: 'user',
        parts: [
          { text: PROMPT_IMAGEN },
          { inlineData: { mimeType, data: base64 } },
        ],
      }],
      generationConfig: {
        maxOutputTokens: 4096,
        temperature: 0.1,
      },
    });

    if (!resp.ok) return { items: [], error: `Error API ${resp.status}`, index };

    const data = await resp.json();
    const texto = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    if (!texto) return { items: [], error: 'Respuesta vacía', index };

    const parsed = extraerJSONArray(texto);
    if (!parsed) return { items: [], error: 'No se pudo parsear la respuesta', index };

    const items = parsed
      .map(normalizeItem)
      .filter((x): x is PreviewItem => x !== null);

    return { items, index };
  } catch (e: any) {
    return { items: [], error: e?.message ?? 'Error', index };
  }
}

async function analizarUnPDF(
  base64: string,
  mimeType: string,
): Promise<{ items: PreviewItem[]; banco?: string; error?: string; totalEsperado?: number }> {
  try {
    const resp = await llamarAIProxy({
      contents: [{
        role: 'user',
        parts: [
          { text: PROMPT_PDF },
          { inlineData: { mimeType, data: base64 } },
        ],
      }],
      generationConfig: {
        maxOutputTokens: 65536,
        temperature: 0.1,
      },
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      return { items: [], error: `Error API (${resp.status}): ${errText.slice(0, 200)}` };
    }

    const data = await resp.json();
    const texto = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    if (!texto) return { items: [], error: 'Respuesta vacía' };

    if (__DEV__) {
      console.log('=== BATCH GEMINI RAW LENGTH ===', texto.length);
      console.log('=== BATCH GEMINI RAW INICIO ===', texto.slice(0, 500));
      console.log('=== BATCH GEMINI RAW FIN ===', texto.slice(-500));
    }

    let parsed = extraerJSONArray(texto);
    if (__DEV__) console.log('=== BATCH PARSED COUNT ===', parsed?.length);
    if (!parsed) return { items: [], error: 'No se pudo parsear la respuesta' };

    let banco: string | undefined;
    let totalEsperado: number | undefined;
    if (parsed.length > 0 && !Array.isArray(parsed[0]) && parsed[0]?.banco) {
      banco = String(parsed[0].banco);
      totalEsperado = typeof parsed[0].total === 'number' ? parsed[0].total : undefined;
      parsed = parsed.slice(1);
    }

    const items = parsed
      .map(normalizeItem)
      .filter((x): x is PreviewItem => x !== null);

    return { items, banco, totalEsperado };
  } catch (e: any) {
    return { items: [], error: e?.message ?? 'Error' };
  }
}

export interface ArchivoInput {
  uri: string;
  mimeType: string;
  nombre: string;
}

export interface BatchResult {
  items: PreviewItem[];
  banco?: string;
  errores: { archivo: string; error: string }[];
  totalArchivos: number;
  archivosOk: number;
}

async function uriToBase64(uri: string): Promise<string> {
  try {
    const { File } = await import('expo-file-system');
    const file = new File(uri);
    const bytes = new Uint8Array(await file.bytes());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    }
    return btoa(binary);
  } catch {
    return '';
  }
}

export async function procesarArchivosEnBatch(
  archivos: ArchivoInput[],
  onProgreso?: (procesados: number, total: number) => void,
): Promise<BatchResult> {
  const CONCURRENCY = 4;
  const errores: { archivo: string; error: string }[] = [];
  let allItems: PreviewItem[] = [];
  let banco: string | undefined;
  let archivosOk = 0;

  const settled = await Promise.allSettled(
    archivos.map(async (archivo) => {
      const base64 = await uriToBase64(archivo.uri);
      return { ...archivo, base64 };
    }),
  );
  const conBase64 = settled
    .filter((r): r is PromiseFulfilledResult<{ uri: string; mimeType: string; nombre: string; base64: string }> => r.status === 'fulfilled')
    .map(r => r.value);

  for (let i = 0; i < conBase64.length; i += CONCURRENCY) {
    const lote = conBase64.slice(i, i + CONCURRENCY);

    const resultados = await Promise.allSettled(
      lote.map((archivo) => {
        const isPDF = archivo.mimeType === 'application/pdf';
        if (isPDF) {
          return analizarUnPDF(archivo.base64, archivo.mimeType)
            .then(r => ({ ...r, nombre: archivo.nombre }));
        } else {
          return analizarUnaImagen(archivo.base64, archivo.mimeType, 0)
            .then(r => ({ ...r, nombre: archivo.nombre }));
        }
      }),
    );

    for (const res of resultados) {
      const nombre = lote[resultados.indexOf(res)]?.nombre ?? 'archivo';

      if (res.status === 'rejected') {
        errores.push({ archivo: nombre, error: res.reason?.message ?? 'Error' });
        continue;
      }

      const val = res.value;
      if (val.error && val.items.length === 0) {
        errores.push({ archivo: nombre, error: val.error });
        continue;
      }

      if (val.items.length > 0) {
        allItems = [...allItems, ...val.items];
        archivosOk++;
      }

      if (!banco && 'banco' in val && val.banco) {
        banco = val.banco;
      }
    }

    onProgreso?.(Math.min(i + CONCURRENCY, conBase64.length), conBase64.length);
  }

  const itemsFinales = deduplicar(allItems).sort(
    (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime(),
  );

  return {
    items: itemsFinales,
    banco,
    errores,
    totalArchivos: archivos.length,
    archivosOk,
  };
}

export async function procesarPDFdesdeURI(
  uri: string,
  mimeType = 'application/pdf',
): Promise<{ items: PreviewItem[]; banco?: string; error?: string }> {
  const base64 = await uriToBase64(uri);
  return analizarUnPDF(base64, mimeType);
}

export async function procesarImagenDesdeURI(
  uri: string,
  mimeType: string,
): Promise<{ items: PreviewItem[]; error?: string }> {
  const base64 = await uriToBase64(uri);
  const res = await analizarUnaImagen(base64, mimeType, 0);
  return { items: res.items, error: res.error };
}
