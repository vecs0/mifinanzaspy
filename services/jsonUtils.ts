/**
 * jsonUtils
 * Responsabilidad: Utilidades compartidas para limpieza y extracción de JSON
 * Usado por: importService, batchImportService, ocrService
 */

export function limpiarJSON(texto: string): string {
  let t = texto
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
  return t;
}

export function findClose(src: string, from: number): number {
  let depth = 0;
  let inStr = false;
  let escape = false;
  for (let i = from; i < src.length; i++) {
    const ch = src[i];
    if (escape)          { escape = false; continue; }
    if (ch === '\\')     { escape = true;  continue; }
    if (ch === '"')      { inStr = !inStr; continue; }
    if (inStr)           { continue; }
    if (ch === '[' || ch === '{') { depth++; continue; }
    if (ch === ']' || ch === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

export function extractElements(src: string, arrayStart: number): any[] {
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
    try { items.push(JSON.parse(src.slice(pos, closeIdx + 1))); } catch { console.warn('[JSONUtils] Error'); }
    pos = closeIdx + 1;
    while (pos < src.length && /[\s,]/.test(src[pos])) pos++;
  }
  return items;
}

export function extraerJSONArray(texto: string): any[] | null {
  const firstBracket = texto.indexOf('[');
  if (firstBracket === -1) return null;
  return extractElements(texto, firstBracket);
}