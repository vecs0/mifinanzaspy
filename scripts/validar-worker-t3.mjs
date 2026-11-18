/**
 * validar-worker-t3.mjs
 * Responsabilidad: validacion manual del Worker gemini-proxy (T3) con extractos bancarios y
 *   comprobantes reales, replicando los prompts y generationConfig de la app
 * Uso: node scripts/validar-worker-t3.mjs --pdf <carpeta> --fotos <carpeta>
 * Depende de: .env.local (EXPO_PUBLIC_WORKER_URL, EXPO_PUBLIC_WORKER_APP_TOKEN), fetch de Node 18+
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const ENV_FILE = path.join(REPO_ROOT, '.env.local');
const MAX_ARCHIVOS = 5;
const LIMITE_WORKER_BYTES = 12 * 1024 * 1024;
const MAX_INTENTOS = 3;
const REINTENTABLES = new Set([429, 500, 502, 503, 504]);

const PROMPT_PDF = `EXTRACTO BANCARIO — extraé ABSOLUTAMENTE TODAS las transacciones. No omitas ninguna.

Primero identificá el banco (Ueno, Itaú, Continental, Familiar, Regional, Mango, etc).

Respondé SOLO con un array JSON válido. Sin texto, sin markdown, sin bloques de código.

Estructura del array:
- El PRIMER elemento es metadata: {"banco":"NombreDelBanco","total":N,"saldoInicial":N,"saldoFinal":N}
- Los siguientes son transacciones en formato de 5 elementos:
  ["YYYY-MM-DD","descripcion completa",monto,"banco_contraparte_o_null","nombre_contraparte_o_null"]

REGLAS de la metadata:
- "total": la cantidad de transacciones que tiene el extracto
- "saldoInicial": el saldo inicial que imprime el extracto, entero en guaraníes (sin puntos, sin decimales)
- "saldoFinal": el saldo final que imprime el extracto, entero en guaraníes (sin puntos, sin decimales)
- Si el extracto no muestra saldo inicial o saldo final, omití ese campo: no lo inventes

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
- La columna Saldo NO va en las filas: el saldo inicial y el saldo final van solo en la metadata
- NO incluyas encabezados ni pies de página en las filas
- Array vacío [] si no hay datos

EJEMPLO:
[{"banco":"Ueno","total":3,"saldoInicial":150000,"saldoFinal":80000},["2026-05-12T14:32","Tigo Pago de Facturas",-97000,null,null],["2026-05-12T09:15","Transferencia Recibida de Clara Sosa",97000,"itau","Clara Sosa"],["2026-05-12T11:05","Transferencia Enviada a Antonia Ramirez",-90000,"itau","Antonia Ramirez"]]`;

const PROMPT_FOTO = `Analizá este comprobante o imagen financiera.

Respondé SOLO con un array JSON. Sin texto extra. Sin markdown.
Formato de cada elemento: {"monto":numero,"descripcion":"texto","fecha":"YYYY-MM-DD"}

Reglas:
- monto positivo = ingreso, negativo = egreso
- Extraé TODAS las transacciones visibles
- Si no hay datos, devolvé []

Ejemplo: [{"monto":-50000,"descripcion":"Supermercado","fecha":"2026-05-29"}]`;

const PROMPT_OCR = `Analizá este comprobante financiero con máximo detalle. Leé TODOS los datos visibles: montos, fechas, horas, nombre del comercio, banco emisor y tipo de operación.

Respondé SOLO con un objeto JSON con estos campos:
- monto: número entero en guaraníes (si el monto está en otra moneda, convertilo o dejalo en la moneda original indicando la moneda)
- descripcion: nombre del comercio, servicio o concepto de la operación (sé específico: "Supermercado Stock", no solo "Supermercado")
- fecha: YYYY-MM-DD (fecha exacta del comprobante, no la de impresión si difieren)
- hora: HH:MM en formato 24h (si aparece en el comprobante, si no omitir el campo)
- tipo: "egreso" si es un pago/débito/retiro, "ingreso" si es un cobro/crédito/depósito
- banco: nombre exacto del banco o entidad emisora (ej: "Itaú", "Ueno", "Banco Continental", "Banco GNB", "Mango", "Banco Familiar", "Banco Regional", "BBVA", "Sudameris", o "Desconocido" si no se puede identificar)

Ejemplo completo: {"monto":185000,"descripcion":"Farmacia Catedral","fecha":"2026-05-29","hora":"14:32","tipo":"egreso","banco":"Itaú"}

Si hay múltiples transacciones en el comprobante, extraé la principal (la de mayor monto o la más reciente).
Nada de texto extra, solo el JSON.`;

const MIME = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

function leerEnvLocal() {
  if (!fs.existsSync(ENV_FILE)) {
    throw new Error(`No existe ${ENV_FILE}. Copiá .env.example a .env.local como indica docs/SETUP.md.`);
  }
  const vars = {};
  for (const linea of fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
    const limpia = linea.trim();
    if (!limpia || limpia.startsWith('#')) continue;
    const m = limpia.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    vars[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
  }
  return vars;
}

function parseArgs(argv) {
  const dirTemp = path.join(os.tmpdir(), 'opencode', 'validacion-t3');
  const opciones = {
    pdf: process.env.VALIDAR_PDF_DIR || path.join(dirTemp, 'pdf'),
    fotos: process.env.VALIDAR_FOTOS_DIR || path.join(dirTemp, 'fotos'),
    timeoutMs: 120000,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--pdf') opciones.pdf = path.resolve(argv[++i] ?? '');
    else if (arg === '--fotos') opciones.fotos = path.resolve(argv[++i] ?? '');
    else if (arg === '--timeout') opciones.timeoutMs = Number(argv[++i] ?? 120000);
    else if (arg === '--help' || arg === '-h') opciones.ayuda = true; else {
      throw new Error(`Argumento no reconocido: ${arg}`);
    }
  }
  return opciones;
}

function listarArchivos(carpeta, extensiones) {
  if (!fs.existsSync(carpeta)) {
    fs.mkdirSync(carpeta, { recursive: true });
    return { existe: false, archivos: [] };
  }
  const todos = fs
    .readdirSync(carpeta, { withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => e.name)
    .filter((n) => extensiones.includes(path.extname(n).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, 'es'));
  return { existe: true, archivos: todos.slice(0, MAX_ARCHIVOS), total: todos.length };
}

function armarBody(prompt, mimeType, base64, generationConfig) {
  const contents = [
    {
      role: 'user',
      parts: [{ text: prompt }, { inlineData: { mimeType, data: base64 } }],
    },
  ];
  return { contents, generationConfig };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function enviar(workerUrl, token, geminiBody, timeoutMs) {
  let ultimo = null;
  for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['x-app-token'] = token;
      const resp = await fetch(workerUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ body: geminiBody }),
        signal: controller.signal,
      });
      if (!REINTENTABLES.has(resp.status) || intento === MAX_INTENTOS) return resp;
      ultimo = resp;
    } catch (e) {
      if (intento === MAX_INTENTOS) {
        return { ok: false, status: 0, texto: `error de red: ${e.name === 'AbortError' ? 'timeout' : e.message}` };
      }
    } finally {
      clearTimeout(timer);
    }
    await sleep(Math.min(1000 * Math.pow(2, intento - 1), 8000));
  }
  return ultimo;
}

async function leerRespuesta(resp) {
  if (resp.status === 0) return { status: 0, json: null, errorTexto: resp.texto };
  const crudo = await resp.text();
  let json = null;
  try {
    json = JSON.parse(crudo);
  } catch {
    json = null;
  }
  return { status: resp.status, json, crudo };
}

function textoDeRespuesta(json) {
  const candidato = json?.candidates?.[0] ?? json?.result?.candidates?.[0];
  const partes = candidato?.content?.parts ?? [];
  return partes.map((p) => (typeof p?.text === 'string' ? p.text : '')).join('');
}

function contarElementos(texto) {
  const inicio = texto.indexOf('[');
  if (inicio === -1) return null;
  let prof = 0;
  let elementos = 0;
  let dentro = false;
  let inicioRaiz = -1;
  for (let i = inicio; i < texto.length; i++) {
    const ch = texto[i];
    if (ch === '[' || ch === '{') {
      prof++;
      if (prof === 1) inicioRaiz = i;
      if (prof === 2 && ch === '{') dentro = true;
      if (prof === 2 && ch === '[') dentro = true;
    } else if (ch === ']' || ch === '}') {
      if (prof === 2 && dentro) {
        elementos++;
        dentro = false;
      }
      prof--;
      if (prof === 0) return { elementos, cerrado: true };
    }
  }
  return { elementos, cerrado: false, desde: inicioRaiz };
}

function recorte(texto) {
  const limpio = texto.replace(/\s+/g, ' ').trim();
  return limpio.length > 120 ? `${limpio.slice(0, 120)}...` : limpio;
}

function imprimeCaso(titulo, nombre, archivo, resultado) {
  const { status, json, errorTexto, crudo } = resultado;
  const candidato = json?.candidates?.[0] ?? json?.result?.candidates?.[0];
  const texto = textoDeRespuesta(json);
  const uso = json?.usageMetadata ?? {};
  const finish = candidato?.finishReason ?? '-';
  const modelo = json?.modelVersion ?? '-';
  const kb = Math.round(fs.statSync(archivo).size / 1024);

  console.log(`\n[${titulo}] ${nombre} (${kb} KB)`);
  if (status === 0) {
    console.log(`  ERROR DE RED: ${errorTexto}`);
    return { status, finish, modelo, texto, uso, ok: false };
  }
  console.log(`  HTTP ${status} | finishReason ${finish} | modelVersion ${modelo}`);
  if (status !== 200) {
    const detalle = json ? JSON.stringify(json).slice(0, 240) : String(crudo ?? '').slice(0, 240);
    console.log(`  ERROR HTTP: ${detalle}`);
    return { status, finish, modelo, texto, uso, ok: false };
  }
  const pensamientos = uso.thoughtsTokenCount ?? 0;
  console.log(
    `  usage: prompt ${uso.promptTokenCount ?? '?'} / candidates ${uso.candidatesTokenCount ?? '?'} / total ${
      uso.totalTokenCount ?? '?'
    } / thoughts ${pensamientos}`,
  );
  const conteo = contarElementos(texto);
  const detalleArray = conteo
    ? ` | array: ${conteo.elementos} elemento(s)${conteo.cerrado ? '' : ' (sin cerrar)'}`
    : ' | array: no detectado';
  console.log(`  texto: ${texto.length} chars${detalleArray}`);
  console.log(`  inicio: "${recorte(texto)}"`);
  return { status, finish, modelo, texto, uso, pensamientos, ok: true };
}

function crearModulo({ workerUrl, token, timeoutMs }) {
  return async (titulo, nombre, archivo, geminiBody) => {
    const base64 = fs.readFileSync(archivo).toString('base64');
    const cuerpo = armarBody(geminiBody.prompt, geminiBody.mimeType, base64, geminiBody.generationConfig);
    const tamanoPayload = JSON.stringify({ body: cuerpo }).length;
    if (tamanoPayload > LIMITE_WORKER_BYTES) {
      console.log(`\n[${titulo}] ${nombre}`);
      console.log(`  OMITIDO: payload de ${(tamanoPayload / 1024 / 1024).toFixed(1)} MB supera el limite de 12 MB del Worker`);
      return { status: 'omitido', finish: '-', modelo: '-', texto: '', uso: {}, ok: false };
    }
    const resp = await enviar(workerUrl, token, cuerpo, timeoutMs);
    const leida = await leerRespuesta(resp);
    return imprimeCaso(titulo, nombre, archivo, leida);
  };
}

async function main() {
  const opciones = parseArgs(process.argv.slice(2));
  if (opciones.ayuda) {
    console.log('Uso: node scripts/validar-worker-t3.mjs --pdf <carpeta> --fotos <carpeta> [--timeout ms]');
    console.log('Defaults: %TEMP%\\opencode\\validacion-t3\\pdf y %TEMP%\\opencode\\validacion-t3\\fotos');
    console.log('Alternativa: VALIDAR_PDF_DIR y VALIDAR_FOTOS_DIR como variables de entorno.');
    return 0;
  }
  const env = leerEnvLocal();
  const workerUrl = env.EXPO_PUBLIC_WORKER_URL;
  const token = env.EXPO_PUBLIC_WORKER_APP_TOKEN || '';
  if (!workerUrl) throw new Error('EXPO_PUBLIC_WORKER_URL vacio en .env.local');
  if (token) console.log(`Token de app: presente (${token.length} chars, no se imprime)`);
  else console.log('Token de app: ausente (el Worker no exige x-app-token)');
  console.log(`Worker: ${workerUrl}`);
  console.log(`Timeout por llamada: ${opciones.timeoutMs} ms | reintentos en 429/5xx: ${MAX_INTENTOS - 1}`);

  const pdfs = listarArchivos(opciones.pdf, ['.pdf']);
  const fotos = listarArchivos(opciones.fotos, ['.jpg', '.jpeg', '.png', '.webp']);
  console.log(`\nCarpeta PDFs: ${opciones.pdf} -> ${pdfs.archivos.length} archivo(s)${pdfs.existe ? '' : ' (creada, estaba vacia)'}`);
  console.log(`Carpeta fotos: ${opciones.fotos} -> ${fotos.archivos.length} archivo(s)${fotos.existe ? '' : ' (creada, estaba vacia)'}`);

  if (pdfs.total !== undefined && pdfs.total > MAX_ARCHIVOS) console.log(`  Aviso: hay ${pdfs.total} PDFs, se usan los primeros ${MAX_ARCHIVOS} por nombre`);
  if (fotos.total !== undefined && fotos.total > MAX_ARCHIVOS) console.log(`  Aviso: hay ${fotos.total} fotos, se usan las primeras ${MAX_ARCHIVOS} por nombre`);
  if (pdfs.archivos.length > 0 && pdfs.archivos.length < MAX_ARCHIVOS) console.log(`  Aviso: solo hay ${pdfs.archivos.length} PDF(s), se valida con esos`);
  if (fotos.archivos.length > 0 && fotos.archivos.length < MAX_ARCHIVOS) console.log(`  Aviso: solo hay ${fotos.archivos.length} foto(s), se valida con esas`);

  if (pdfs.archivos.length === 0 && fotos.archivos.length === 0) {
    console.log('\nNo hay archivos para validar. Copiá 5 PDFs de extracto y 5 fotos de comprobante en esas carpetas y volvé a correr:');
    console.log(`  node scripts/validar-worker-t3.mjs --pdf "${opciones.pdf}" --fotos "${opciones.fotos}"`);
    return 0;
  }

  const correr = crearModulo({ workerUrl, token, timeoutMs: opciones.timeoutMs });
  const resultados = [];

  for (const nombre of pdfs.archivos) {
    const archivo = path.join(opciones.pdf, nombre);
    resultados.push({
      tipo: 'pdf',
      nombre,
      ...(await correr('PDF analizarPDF', nombre, archivo, {
        prompt: PROMPT_PDF,
        mimeType: 'application/pdf',
        generationConfig: { maxOutputTokens: 65536, temperature: 0.1 },
      })),
    });
  }

  for (const nombre of fotos.archivos) {
    const archivo = path.join(opciones.fotos, nombre);
    const mimeType = MIME[path.extname(nombre).toLowerCase()];
    resultados.push({
      tipo: 'foto',
      nombre,
      ...(await correr('FOTO batchImport', nombre, archivo, {
        prompt: PROMPT_FOTO,
        mimeType,
        generationConfig: { maxOutputTokens: 4096, temperature: 0.1 },
      })),
    });
  }

  if (fotos.archivos.length > 0) {
    const nombre = fotos.archivos[0];
    const archivo = path.join(opciones.fotos, nombre);
    const mimeType = MIME[path.extname(nombre).toLowerCase()];
    resultados.push({
      tipo: 'ocr',
      nombre,
      ...(await correr('FOTO ocrService 300', nombre, archivo, {
        prompt: PROMPT_OCR,
        mimeType,
        generationConfig: { maxOutputTokens: 300 },
      })),
    });
  } else {
    console.log('\n[FOTO ocrService 300] omitido: no hay fotos para probar el tope de 300 tokens');
  }

  const stop = resultados.filter((r) => r.finish === 'STOP').length;
  const maxTokens = resultados.filter((r) => r.finish === 'MAX_TOKENS').length;
  const otrosFinish = resultados.filter((r) => r.finish !== 'STOP' && r.finish !== 'MAX_TOKENS' && r.status !== 'omitido').length;
  const erroresHttp = resultados.filter((r) => typeof r.status === 'number' && r.status !== 200).length;
  const vacios = resultados.filter((r) => r.status === 200 && r.texto.trim().length === 0).length;
  const omitidos = resultados.filter((r) => r.status === 'omitido').length;
  const modelos = [...new Set(resultados.map((r) => r.modelo).filter((m) => m && m !== '-'))];

  console.log('\n================ RESUMEN ================');
  console.log(`Llamadas: ${resultados.length} (PDF ${pdfs.archivos.length}, fotos ${fotos.archivos.length}, extra OCR ${fotos.archivos.length > 0 ? 1 : 0})`);
  console.log(`STOP: ${stop} | MAX_TOKENS: ${maxTokens} | otros finishReason: ${otrosFinish}`);
  console.log(`Errores HTTP/red: ${erroresHttp} | respuestas vacias: ${vacios} | omitidos: ${omitidos}`);
  console.log(`modelVersion visto: ${modelos.length > 0 ? modelos.join(', ') : 'no informado'}`);
  const pensamientoTotal = resultados.reduce((acc, r) => acc + (r.pensamientos ?? 0), 0);
  if (pensamientoTotal > 0) console.log(`thoughtsTokenCount acumulado: ${pensamientoTotal}`);

  const fallo = maxTokens > 0 || erroresHttp > 0 || vacios > 0 || omitidos > 0;
  if (fallo) {
    console.log('VEREDICTO: REVISAR');
    if (maxTokens > 0) console.log('  - Hay MAX_TOKENS: subir el tope del caso afectado o fijar el nivel de razonamiento.');
    if (vacios > 0) console.log('  - Hay respuestas vacias: revisar partes de razonamiento y finishReason.');
    if (erroresHttp > 0) console.log('  - Hay errores HTTP: revisar el detalle arriba (rate limit, tamano, secret del Worker).');
    if (omitidos > 0) console.log('  - Hay archivos omitidos por tamano: reducirlos antes de reintentar.');
    return 1;
  }
  console.log('VEREDICTO: VALIDACION OK');
  return 0;
}

main()
  .then((codigo) => {
    process.exitCode = codigo;
  })
  .catch((e) => {
    console.error(`\nERROR: ${e.message}`);
    process.exitCode = 2;
  });
