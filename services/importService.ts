/**
 * importService
 * Responsabilidad: Parseo CSV/PDF e importación con IA
 * Usado por: importar, comprobante, BatchPickerScreen, batchImportService, transaccionValidator
 * Depende de: database, apiConfig, expo-file-system
 */
import { File } from 'expo-file-system';
import { insertTransaccion, getCuentas } from '@/services/database';
import { llamarAIProxy } from '@/services/apiConfig';
import { limpiarJSON, findClose, extractElements } from '@/services/jsonUtils';

export function extraerJSONArray(texto: string): any[] | null {
  const crudo = texto.trim();
  const rootStart = crudo.indexOf('[');
  if (rootStart !== -1) {
    const rootClose = findClose(crudo, rootStart);

    if (rootClose !== -1) {
      const sliced = crudo.slice(rootStart, rootClose + 1);
      try {
        const p = JSON.parse(sliced);
        if (Array.isArray(p) && p.length > 0) return p;
      } catch {
        const elems = extractElements(crudo, rootStart);
        if (elems.length > 0) return elems;
      }
    } else {
      const elems = extractElements(crudo, rootStart);
      if (elems.length > 0) return elems;
    }
  }

  const limpio = limpiarJSON(crudo);
  const rootStart2 = limpio.indexOf('[');
  if (rootStart2 !== -1) {
    const rootClose2 = findClose(limpio, rootStart2);

    if (rootClose2 !== -1) {
      const sliced2 = limpio.slice(rootStart2, rootClose2 + 1);
      try {
        const p = JSON.parse(sliced2);
        if (Array.isArray(p) && p.length > 0) return p;
      } catch {
        const elems = extractElements(limpio, rootStart2);
        if (elems.length > 0) return elems;
      }
    } else {
      const elems = extractElements(limpio, rootStart2);
      if (elems.length > 0) return elems;
    }
  }

  return null;
}

export interface ResultadoImportacion {
  ok: number;
  errores: number;
  erroresDetalle: string[];
}

export interface PreviewItem {
  monto: number;
  tipo: 'debito' | 'credito';
  descripcion: string;
  fecha: string;
  categoriaId: string;
  contraparteBancoId?: string | null;
  contraparteNombre?: string | null;
}

function parseCSV(text: string): string[][] {
  const lines = text.trim().split('\n');
  return lines.map(line => {
    const cols: string[] = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuote = !inQuote; continue; }
      if (ch === ',' && !inQuote) { cols.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    cols.push(cur.trim());
    return cols;
  });
}

export async function parseCSVtoPreview(uri: string): Promise<{ items: PreviewItem[]; error?: string }> {
  try {
    const content = await new File(uri).text();
    const rows = parseCSV(content);
    if (rows.length < 2) return { items: [], error: 'CSV vacío o sin datos' };

    const header = rows[0].map(h => h.toLowerCase().trim());
    const fechaIdx = header.findIndex(h => h.includes('fecha') || h === 'date');
    const montoIdx = header.findIndex(h => h.includes('monto') || h.includes('importe') || h === 'amount');
    const descIdx = header.findIndex(h => h.includes('descrip') || h === 'concepto' || h === 'description');

    if (fechaIdx === -1 || montoIdx === -1) {
      return { items: [], error: 'Formato CSV no reconocido. Se necesitan columnas: fecha, monto, descripcion' };
    }

    const items: PreviewItem[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length < 2) continue;

      const fechaRaw = row[fechaIdx] ?? '';
      const montoRaw = (row[montoIdx] ?? '').replace(/[^\d-]/g, '');
      const monto = parseInt(montoRaw, 10);
      if (isNaN(monto) || monto === 0) continue;

      let fecha = fechaRaw;
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(fechaRaw)) {
        const [d, m, y] = fechaRaw.split('/');
        fecha = `${y}-${m}-${d}T12:00:00`;
      } else if (/^\d{4}-\d{2}-\d{2}$/.test(fechaRaw)) {
        fecha = `${fechaRaw}T12:00:00`;
      } else {
        fecha = new Date().toISOString();
      }

      items.push({
        monto,
        tipo: monto < 0 ? 'debito' : 'credito',
        descripcion: (descIdx >= 0 ? row[descIdx] ?? '' : '').trim(),
        fecha,
        categoriaId: 'otros',
      });
    }

    return { items };
  } catch (e: any) {
    return { items: [], error: e?.message ?? 'Error leyendo archivo' };
  }
}

const PREFILL_ARR = '[{"monto":';
export async function parseOCRtoPreview(base64: string, mimeType: string): Promise<{ items: PreviewItem[]; error?: string }> {
  try {
    const resp = await llamarAIProxy({
      contents: [
        {
          role: 'user',
          parts: [
            { text: `Analizá este documento financiero.

Respondé SOLO con un array JSON. Cada elemento: {"monto":numero,"descripcion":"texto","fecha":"YYYY-MM-DD"}

Reglas:
- monto positivo=ingreso, negativo=egreso
- Si no hay datos, array vacío []

Ejemplo: [{"monto":-50000,"descripcion":"Supermercado","fecha":"2026-05-29"}]` },
            { inlineData: { mimeType, data: base64 } },
          ],
        },
        {
          role: 'model',
          parts: [{ text: PREFILL_ARR }],
        },
      ],
      generationConfig: { maxOutputTokens: 1024 },
    });

    if (!resp.ok) return { items: [], error: `Error API (${resp.status})` };

    const data = await resp.json();
    const candidates = data.candidates ?? data.result?.candidates ?? [];
    let texto = candidates[0]?.content?.parts?.[0]?.text ?? '';
    if (!texto) return { items: [], error: 'Respuesta vacía de la IA' };
    texto = PREFILL_ARR + texto;

    let parsed = extraerJSONArray(texto);
    if (!parsed) return { items: [], error: `No se pudo interpretar: ${texto.slice(0, 300)}` };

    if (!Array.isArray(parsed)) parsed = [parsed];

    const items: PreviewItem[] = parsed
      .filter((p: any) => p.monto != null && !isNaN(p.monto) && p.monto !== 0)
      .map((p: any) => ({
        monto: p.monto,
        tipo: p.monto < 0 ? 'debito' : 'credito',
        descripcion: p.descripcion ?? '',
        fecha: p.fecha ?? new Date().toISOString().slice(0, 10),
        categoriaId: 'otros',
      }));

    if (items.length === 0) return { items: [], error: 'No se encontraron transacciones en el documento' };

    return { items };
  } catch (e: any) {
    return { items: [], error: e?.message ?? 'Error procesando documento' };
  }
}

export async function analizarPDF(base64: string, mimeType: string): Promise<{ items: PreviewItem[]; error?: string; banco?: string; totalEsperado?: number }> {
  try {
    const resp = await llamarAIProxy({
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `EXTRACTO BANCARIO — extraé ABSOLUTAMENTE TODAS las transacciones. No omitas ninguna.

Primero identificá el banco (Ueno, Itaú, Continental, Familiar, Regional, Mango, etc).

Respondé SOLO con un array JSON válido. Sin texto, sin markdown, sin bloques de código.

Estructura del array:
- El PRIMER elemento es metadata: {"banco":"NombreDelBanco","total":N}
- Los siguientes son transacciones en formato de 5 elementos:
  ["YYYY-MM-DD","descripcion completa",monto,"banco_contraparte_o_null","nombre_contraparte_o_null"]

REGLAS por campo:
- Campo [0] Fecha: convertir DD/MM/AAAA HH:MM → "YYYY-MM-DDTHH:MM" (incluir hora si existe). Si no hay hora → "YYYY-MM-DD"
- Campo [1] Descripcion: copiar TAL CUAL aparece, sin modificar
- Campo [2] Monto: columna "Importe". Positivo = ingreso, negativo = egreso.
  Convertir "97.000" → 97000, "-97.000" → -97000 (quitar puntos, sin decimales)
- Campo [3] Banco contraparte: si la descripción menciona un banco, poner su ID (itau, ueno, continental, familiar, regional, mango, bancop, etc).
  Si no hay banco mencionado → null
- Campo [4] Nombre contraparte: si hay nombre de persona o empresa en la descripción → extraerlo.
  Ej: "Antonia Ramirez", "SUPERMERCADO DON BETO", "Clara Sosa"
  Si no hay nombre → null
- NO incluyas la columna Saldo
- NO incluyas encabezados, pies de página, ni el saldo final/inicial
- Array vacío [] si no hay datos

EJEMPLO:
[{"banco":"Ueno","total":3},["2026-05-12T14:32","Tigo Pago de Facturas",-97000,null,null],["2026-05-12T09:15","Transferencia Recibida de Clara Sosa",97000,"itau","Clara Sosa"],["2026-05-12T11:05","Transferencia Enviada a Antonia Ramirez",-90000,"itau","Antonia Ramirez"]]`,
            },
            { inlineData: { mimeType, data: base64 } },
          ],
        },
      ],
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
    let texto: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    if (__DEV__) {
      console.log('=== GEMINI RAW LENGTH ===', texto.length);
      console.log('=== GEMINI RAW INICIO ===', texto.slice(0, 500));
      console.log('=== GEMINI RAW FIN ===', texto.slice(-500));
    }

    if (!texto) return { items: [], error: 'Respuesta vacía de Gemini' };

    let parsed = extraerJSONArray(texto);
    if (__DEV__) console.log('=== PARSED COUNT ===', parsed?.length);

    if (!parsed) {
      return { items: [], error: `No se pudo interpretar la respuesta: ${texto.slice(0, 300)}` };
    }
    if (!Array.isArray(parsed)) parsed = [parsed];

    let bancoDetectado: string | undefined;
    let totalEsperado: number | undefined;
    if (parsed.length > 0 && !Array.isArray(parsed[0]) && parsed[0]?.banco) {
      bancoDetectado = String(parsed[0].banco);
      totalEsperado = typeof parsed[0].total === 'number' ? parsed[0].total : undefined;
      parsed = parsed.slice(1);
    }

    const items: PreviewItem[] = parsed
      .filter((p: any) => {
        if (Array.isArray(p)) return p.length >= 3 && p[2] != null && !isNaN(Number(p[2])) && Number(p[2]) !== 0;
        return p?.monto != null && !isNaN(Number(p.monto)) && Number(p.monto) !== 0;
      })
      .map((p: any): PreviewItem => {
        if (Array.isArray(p)) {
          const montoNum = typeof p[2] === 'string'
            ? parseInt(p[2].replace(/\./g, ''), 10)
            : Number(p[2]);
          const fechaStr = String(p[0] ?? '');
          const fechaFinal = fechaStr.length >= 16
            ? `${fechaStr}:00`
            : `${fechaStr.slice(0, 10)}T00:00:00`;
          return {
            monto: montoNum,
            tipo: montoNum < 0 ? 'debito' : 'credito',
            descripcion: String(p[1] ?? '').trim(),
            fecha: fechaFinal,
            categoriaId: 'otros',
            contraparteBancoId: p[3] != null ? String(p[3]) : null,
            contraparteNombre: p[4] != null ? String(p[4]) : null,
          };
        }
        const montoNum = typeof p.monto === 'string'
          ? parseInt(p.monto.replace(/\./g, ''), 10)
          : Number(p.monto);
        const fechaObjStr = String(p.fecha ?? '');
        const fechaObjFinal = fechaObjStr.length >= 16
          ? `${fechaObjStr}:00`
          : `${fechaObjStr.slice(0, 10)}T00:00:00`;
        return {
          monto: montoNum,
          tipo: montoNum < 0 ? 'debito' : 'credito',
          descripcion: String(p.descripcion ?? '').trim(),
          fecha: fechaObjFinal,
          categoriaId: 'otros',
          contraparteBancoId: p.contraparte_banco_id ?? p.contraparteBancoId ?? null,
          contraparteNombre: p.contraparte_nombre ?? p.contraparteNombre ?? null,
        };
      });

    if (items.length === 0) {
      return { items: [], error: 'No se encontraron transacciones en el extracto' };
    }

    return { items, banco: bancoDetectado, totalEsperado };
  } catch (e: any) {
    return { items: [], error: e?.message ?? 'Error procesando PDF' };
  }
}

export async function guardarItems(items: PreviewItem[], cuentaId: string, bancoId: string): Promise<ResultadoImportacion> {
  const result: ResultadoImportacion = { ok: 0, errores: 0, erroresDetalle: [] };

  for (const item of items) {
    try {
      await insertTransaccion({
        cuentaId,
        bancoId,
        monto: item.monto,
        tipo: item.tipo,
        categoriaId: item.categoriaId,
        descripcion: item.descripcion,
        fuente: 'csv',
        fecha: item.fecha,
        saldoPost: null,
        smsRaw: null,
        procesado: false,
        notas: null,
        adjunto: null,
      });
      result.ok++;
    } catch (e: any) {
      result.errores++;
      result.erroresDetalle.push(e?.message ?? 'Error');
    }
  }

  return result;
}

export async function importarCSV(uri: string): Promise<ResultadoImportacion> {
  const result: ResultadoImportacion = { ok: 0, errores: 0, erroresDetalle: [] };
  try {
    const content = await new File(uri).text();
    const rows = parseCSV(content);
    if (rows.length < 2) throw new Error('CSV vacío o sin datos');

    const header = rows[0].map(h => h.toLowerCase());
    const fechaIdx = header.findIndex(h => h.includes('fecha') || h === 'date');
    const montoIdx = header.findIndex(h => h.includes('monto') || h.includes('importe') || h === 'amount');
    const descIdx = header.findIndex(h => h.includes('descrip') || h === 'concepto' || h === 'description');

    if (fechaIdx === -1 || montoIdx === -1) {
      throw new Error('Formato CSV no reconocido. Se necesitan columnas: fecha, monto, descripcion');
    }

    const cuentas = await getCuentas();
    if (cuentas.length === 0) throw new Error('No hay cuentas configuradas');

    const cuentaId = cuentas[0].id;
    const bancoId = cuentas[0].bancoId;

    for (let i = 1; i < rows.length; i++) {
      try {
        const row = rows[i];
        if (row.length < 2) continue;

        const fechaRaw = row[fechaIdx] ?? '';
        const montoRaw = (row[montoIdx] ?? '').replace(/[^\d-]/g, '');
        const monto = parseInt(montoRaw, 10);
        if (isNaN(monto) || monto === 0) { result.errores++; continue; }

        let fecha = fechaRaw;
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(fechaRaw)) {
          const [d, m, y] = fechaRaw.split('/');
          fecha = `${y}-${m}-${d}T12:00:00`;
        } else if (/^\d{4}-\d{2}-\d{2}$/.test(fechaRaw)) {
          fecha = `${fechaRaw}T12:00:00`;
        } else {
          fecha = new Date().toISOString();
        }

        await insertTransaccion({
          cuentaId,
          bancoId,
          monto,
          tipo: monto < 0 ? 'debito' : 'credito',
          categoriaId: 'otros',
          descripcion: (descIdx >= 0 ? row[descIdx] ?? '' : '').trim(),
          fuente: 'csv',
          fecha,
          saldoPost: null,
          smsRaw: null,
          procesado: false,
          notas: null,
          adjunto: null,
        });
        result.ok++;
      } catch (e) {
        result.errores++;
        result.erroresDetalle.push(`Fila ${i + 1}: ${e instanceof Error ? e.message : 'error'}`);
      }
    }
  } catch (e) {
    result.erroresDetalle.push(e instanceof Error ? e.message : 'Error leyendo archivo');
  }
  return result;
}

export async function importarDesdeClipboard(texto: string): Promise<ResultadoImportacion> {
  const result: ResultadoImportacion = { ok: 0, errores: 0, erroresDetalle: [] };
  try {
    const lines = texto.trim().split('\n');
    const rows = lines.map(l => l.split('\t').length > 1 ? l.split('\t') : l.split(','));

    const cuentas = await getCuentas();
    if (cuentas.length === 0) { result.erroresDetalle.push('No hay cuentas'); return result; }
    const cuentaId = cuentas[0].id;
    const bancoId = cuentas[0].bancoId;

    for (const row of rows) {
      try {
        const monto = parseInt((row[row.length - 1] ?? '').replace(/[^\d-]/g, ''), 10);
        if (isNaN(monto) || monto === 0) { result.errores++; continue; }
        await insertTransaccion({
          cuentaId, bancoId, monto,
          tipo: monto < 0 ? 'debito' : 'credito',
          categoriaId: 'otros', descripcion: row.slice(0, -1).join(' ').trim(),
          fuente: 'manual', fecha: new Date().toISOString(),
          saldoPost: null, smsRaw: null, procesado: false, notas: null, adjunto: null,
        });
        result.ok++;
      } catch { result.errores++; }
    }
  } catch (e) {
    result.erroresDetalle.push(e instanceof Error ? e.message : 'Error al importar');
  }
  return result;
}
