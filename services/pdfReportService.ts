/**
 * pdfReportService
 * Responsabilidad: Generación de reportes PDF imprimibles
 * Usado por: (ningún import directo)
 * Depende de: reportGenerator, banks, categories
 */
import { ReporteMensual } from '@/services/reportGenerator';
import { BANCO_POR_ID } from '@/constants/banks';
import { CATEGORIA_POR_ID } from '@/constants/categories';
import type { Transaccion } from '@/types/finance';

function fmtGs(n: number): string {
  return `Gs ${Math.round(n).toLocaleString('es-PY').replace(/,/g, '.')}`;
}

function fmtFecha(f: string): string {
  const d = new Date(f);
  return d.toLocaleDateString('es-PY', { day: '2-digit', month: 'short' });
}

function indicador(mejoro: boolean | null): string {
  if (mejoro === null) return '';
  return mejoro
    ? '<span style="color:#2e7d32;font-weight:700">▲</span>'
    : '<span style="color:#c62828;font-weight:700">▼</span>';
}

export function generarHtmlReporte(
  reporte: ReporteMensual,
  transacciones: Transaccion[],
  reporteAnterior: ReporteMensual | null,
): string {
  const comparacion = reporte.comparacionMesAnterior;
  const mejoroEgresos = comparacion !== null ? comparacion < 0 : null;
  const mejoroNeto = reporteAnterior
    ? reporte.saldoNeto >= reporteAnterior.saldoNeto
    : null;
  const diffNeto = reporteAnterior
    ? reporte.saldoNeto - reporteAnterior.saldoNeto
    : 0;

  let catsHtml = '';
  for (const cat of reporte.topCategorias) {
    const c = CATEGORIA_POR_ID[cat.id];
    const tinte = c?.tinte ?? '#B36A2A';
    catsHtml += `
      <tr>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:12px">
          <span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${tinte};margin-right:6px"></span>
          ${cat.nombre}
        </td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:12px;text-align:right">${fmtGs(cat.total)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:12px;text-align:right">${cat.pct}%</td>
      </tr>`;
  }

  let bancosHtml = '';
  for (const b of reporte.topBancos) {
    const banco = BANCO_POR_ID[b.bancoId];
    bancosHtml += `
      <tr>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:12px">${banco?.nombre ?? b.nombre}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:12px;text-align:right">${fmtGs(b.total)}</td>
      </tr>`;
  }

  let txsHtml = '';
  for (const t of transacciones.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())) {
    const cat = CATEGORIA_POR_ID[t.categoriaId];
    const esIngreso = t.monto > 0;
    txsHtml += `
      <tr>
        <td style="padding:5px 8px;border-bottom:1px solid #f0f0f0;font-size:11px">${fmtFecha(t.fecha)}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #f0f0f0;font-size:11px">
          <span style="display:inline-block;width:6px;height:6px;border-radius:2px;background:${cat?.tinte ?? '#999'};margin-right:4px"></span>
          ${cat?.nombre ?? 'General'}
        </td>
        <td style="padding:5px 8px;border-bottom:1px solid #f0f0f0;font-size:11px;max-width:160px;overflow:hidden">${t.descripcion || '—'}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #f0f0f0;font-size:11px;text-align:right;font-weight:600;color:${esIngreso ? '#2e7d32' : '#c62828'}">
          ${esIngreso ? '+' : '−'}${fmtGs(Math.abs(t.monto))}
        </td>
      </tr>`;
  }

  const pctGastado = reporte.totalIngresos > 0
    ? Math.round((reporte.totalEgresos / reporte.totalIngresos) * 100)
    : 0;

  return `
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Reporte Mensual - ${reporte.nombreMes}</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:-apple-system,Helvetica,Arial,sans-serif; color:#1a1a1a; padding:0; margin:0; }
.header { background:#FAF8F4; padding:28px 24px 20px; border-bottom:2px solid #B36A2A; }
.header h1 { font-size:22px; font-weight:700; color:#181513; margin-bottom:4px; }
.header p { font-size:12px; color:#999; }
.content { padding:20px 24px; }
.resumen { display:flex; gap:12px; margin-bottom:20px; flex-wrap:wrap; }
.card { flex:1; min-width:120px; background:#f9f7f3; border-radius:10px; padding:14px; border:1px solid #ede9e2; }
.card .label { font-size:10px; font-weight:600; color:#999; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px; }
.card .valor { font-size:20px; font-weight:700; font-family:monospace; letter-spacing:-0.5px; margin-bottom:2px; }
.card .sub { font-size:11px; color:#999; }
.pos { color:#2e7d32; }
.neg { color:#c62828; }
.comparacion { background:#f9f7f3; border-radius:10px; padding:14px; border:1px solid #ede9e2; margin-bottom:20px; }
.comparacion h3 { font-size:13px; font-weight:600; color:#666; margin-bottom:8px; }
.comparacion .fila { display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid #eee; font-size:12px; }
.comparacion .fila:last-child { border-bottom:none; }
.seccion { margin-bottom:20px; }
.seccion h3 { font-size:14px; font-weight:600; color:#181513; margin-bottom:10px; padding-bottom:4px; border-bottom:1px solid #ede9e2; }
table { width:100%; border-collapse:collapse; }
th { padding:8px 10px; font-size:11px; font-weight:600; color:#999; text-transform:uppercase; letter-spacing:0.3px; text-align:left; border-bottom:2px solid #ede9e2; }
th.derecha { text-align:right; }
.footer { text-align:center; padding:20px; font-size:10px; color:#bbb; border-top:1px solid #ede9e2; margin-top:20px; }
</style>
</head>
<body>
<div class="header">
  <h1>Reporte Financiero</h1>
  <p>${reporte.nombreMes} · Generado el ${new Date().toLocaleDateString('es-PY', { day:'numeric', month:'long', year:'numeric' })}</p>
</div>

<div class="content">
  <div class="resumen">
    <div class="card">
      <div class="label">Ingresos</div>
      <div class="valor pos">${fmtGs(reporte.totalIngresos)}</div>
    </div>
    <div class="card">
      <div class="label">Egresos</div>
      <div class="valor neg">${fmtGs(reporte.totalEgresos)}</div>
      <div class="sub">${pctGastado}% de ingresos ${indicador(mejoroEgresos)}</div>
    </div>
    <div class="card">
      <div class="label">Balance Neto</div>
      <div class="valor ${reporte.saldoNeto >= 0 ? 'pos' : 'neg'}">${reporte.saldoNeto >= 0 ? '+' : '−'}${fmtGs(Math.abs(reporte.saldoNeto))}</div>
    </div>
    <div class="card">
      <div class="label">Transacciones</div>
      <div class="valor" style="font-size:18px">${transacciones.length}</div>
    </div>
  </div>

  ${reporteAnterior ? `
  <div class="comparacion">
    <h3>${indicador(mejoroNeto)} Comparación vs mes anterior</h3>
    <div class="fila"><span>Ingresos</span><span>${fmtGs(reporte.totalIngresos)} vs ${fmtGs(reporteAnterior.totalIngresos)}</span></div>
    <div class="fila"><span>Egresos</span><span>${fmtGs(reporte.totalEgresos)} vs ${fmtGs(reporteAnterior.totalEgresos)}${indicador(mejoroEgresos)}</span></div>
    <div class="fila ${reporte.saldoNeto >= 0 ? 'pos' : 'neg'}" style="font-weight:700">
      <span>Balance neto</span>
      <span>${fmtGs(reporte.saldoNeto)} (${diffNeto >= 0 ? '+' : '−'}${fmtGs(Math.abs(diffNeto))} vs anterior)</span>
    </div>
  </div>` : ''}

  ${catsHtml ? `
  <div class="seccion">
    <h3>Gastos por categoría</h3>
    <table>
      <tr><th>Categoría</th><th class="derecha">Monto</th><th class="derecha">%</th></tr>
      ${catsHtml}
    </table>
  </div>` : ''}

  ${bancosHtml ? `
  <div class="seccion">
    <h3>Gastos por banco</h3>
    <table>
      <tr><th>Banco</th><th class="derecha">Total</th></tr>
      ${bancosHtml}
    </table>
  </div>` : ''}

  ${txsHtml ? `
  <div class="seccion">
    <h3>Detalle de movimientos</h3>
    <table>
      <tr><th>Fecha</th><th>Categoría</th><th>Descripción</th><th class="derecha">Monto</th></tr>
      ${txsHtml}
    </table>
  </div>` : ''}
</div>

<div class="footer">
  MiFinanzasPY · Reporte generado automáticamente
</div>
</body>
</html>`;
}

export async function asegurarDirectorio(): Promise<void> {
  try {
    const FS = await import('expo-file-system');
    const dir = new FS.Directory(FS.Paths.document, 'reportes');
    if (!dir.exists) {
      dir.create({ intermediates: true });
    }
  } catch (e) {
    console.warn('[PDF] Error asegurando directorio:', e);
  }
}

export async function generarPDF(
  reporte: ReporteMensual,
  transacciones: Transaccion[],
  reporteAnterior: ReporteMensual | null,
): Promise<string> {
  let Print: any;
  let FS: any;
  try {
    const mods = await Promise.all([
      import('expo-print'),
      import('expo-file-system'),
    ]);
    Print = mods[0];
    FS = mods[1];
  } catch (e) {
    console.warn('[PDF] Error importando módulos nativos:', e);
    throw new Error('No se pudieron cargar los módulos de generación de PDF');
  }

  try {
    await asegurarDirectorio();

    const html = generarHtmlReporte(reporte, transacciones, reporteAnterior);
    const { uri } = await Print.printToFileAsync({ html, base64: false });

    const filename = `reporte-${reporte.mes}.pdf`;
    const dir = new FS.Directory(FS.Paths.document, 'reportes');
    const destino = new FS.File(dir, filename);

    if (uri !== destino.uri) {
      if (destino.exists) destino.delete();
      const src = new FS.File(uri);
      try {
        src.move(destino);
      } catch (e) {
        console.warn('[PDF] Error moviendo archivo:', e);
      }
    }

    return destino.uri;
  } catch (e) {
    console.warn('[PDF] Error generando PDF:', e);
    throw new Error('Error al generar el PDF');
  }
}

export async function compartirPDF(path: string): Promise<void> {
  let FS: any;
  let sharing: any;
  try {
    const mods = await Promise.all([
      import('expo-file-system'),
      import('expo-sharing'),
    ]);
    FS = mods[0];
    sharing = mods[1];
  } catch (e) {
    console.warn('[PDF] Error importando módulos para compartir:', e);
    return;
  }

  try {
    if (await sharing.isAvailableAsync()) {
      const file = new FS.File(path);
      await sharing.shareAsync(file.uri, { mimeType: 'application/pdf' });
    }
  } catch (e) {
    console.warn('[PDF] Error compartiendo PDF:', e);
  }
}

export async function listarPDFs(): Promise<{ path: string; name: string; size: number }[]> {
  let FS: any;
  try {
    FS = await import('expo-file-system');
  } catch (e) {
    console.warn('[PDF] Error importando expo-file-system:', e);
    return [];
  }

  await asegurarDirectorio();
  const dir = new FS.Directory(FS.Paths.document, 'reportes');
  let entries: any[];
  try {
    entries = dir.list();
  } catch (e) {
    console.warn('[PDF] Error listando PDFs:', e);
    entries = [];
  }
  const result: { path: string; name: string; size: number }[] = [];
  for (const entry of entries) {
    if (entry instanceof FS.File && entry.name.endsWith('.pdf')) {
      result.push({ path: entry.uri, name: entry.name, size: entry.size });
    }
  }
  return result.sort((a, b) => b.name.localeCompare(a.name));
}
