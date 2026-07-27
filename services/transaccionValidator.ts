/**
 * transaccionValidator
 * Responsabilidad: Validación y merge de transacciones importadas
 * Usado por: ValidationBanner, ResultsScreen, comprobante
 * Depende de: importService
 */
import type { PreviewItem } from '@/services/importService';

export interface ItemValidable {
  monto: number;
  descripcion: string;
  fecha: string;
}

export type NivelWarning = 'info' | 'warning' | 'error';

export interface Warning {
  nivel: NivelWarning;
  codigo: string;
  mensaje: string;
  detalle?: string;
}

export interface ReporteValidacion {
  ok: boolean;
  warnings: Warning[];
  estadisticas: {
    totalItems: number;
    duplicadosDetectados: number;
    itemsMontoRaro: number;
    sumaIngresos: number;
    sumaEgresos: number;
    balanceNeto: number;
    rangoFechas: { desde: string; hasta: string } | null;
  };
  itemsDuplicados: PreviewItem[];
  itemsSospechosos: PreviewItem[];
  itemsMerged: PreviewItem[];
  mergedCount: number;
  itemsFinal: PreviewItem[];
}

export interface OpcionesValidacion {
  totalEsperado?: number;
  toleranciaCantidad?: number;
  banco?: string;
}

const fmtGs = (n: number) =>
  'Gs. ' + Math.abs(Math.round(n)).toLocaleString('es-PY');

const fmtFecha = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('es-PY');
};

function toPreviewItem(item: ItemValidable): PreviewItem {
  return { ...item, tipo: item.monto >= 0 ? 'credito' : 'debito', categoriaId: 'otros' };
}

function claveDedup(item: ItemValidable): string {
  const fecha = item.fecha.slice(0, 10);
  const desc = item.descripcion
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40);
  return `${fecha}|${item.monto}|${desc}`;
}

export function mergeSplitTransactions(items: ItemValidable[]): { items: ItemValidable[]; mergedCount: number } {
  const sorted = [...items].sort((a, b) => {
    const d = a.fecha.slice(0, 10).localeCompare(b.fecha.slice(0, 10));
    if (d !== 0) return d;
    return Math.abs(a.monto) - Math.abs(b.monto);
  });

  const merged = new Set<number>();
  let mergedCount = 0;

  for (let i = 0; i < sorted.length - 1; i++) {
    if (merged.has(i)) continue;
    for (let j = i + 1; j < sorted.length; j++) {
      if (merged.has(j)) continue;

      const a = sorted[i], b = sorted[j];
      if (a.fecha.slice(0, 10) !== b.fecha.slice(0, 10)) break;

      const mismoSigno = (a.monto > 0 && b.monto > 0) || (a.monto < 0 && b.monto < 0);
      if (!mismoSigno) continue;

      const absA = Math.abs(a.monto), absB = Math.abs(b.monto);
      const concat = parseInt(`${absA}${absB}`, 10);
      if (concat > 100_000 && concat % 1000 === 0) {
        sorted[i] = {
          ...a,
          monto: a.monto + b.monto,
          descripcion: `${a.descripcion} / ${b.descripcion}`,
        };
        merged.add(j);
        mergedCount++;
      }
    }
  }

  const result = sorted.filter((_, i) => !merged.has(i));
  return { items: result, mergedCount };
}

function parecePartido(items: ItemValidable[]): ItemValidable[] {
  const sospechosos: ItemValidable[] = [];
  for (let i = 0; i < items.length - 1; i++) {
    const a = Math.abs(items[i].monto);
    const b = Math.abs(items[i + 1].monto);
    const concat = parseInt(`${a}${b}`, 10);
    if (
      concat > 100_000 &&
      concat % 1000 === 0 &&
      items[i].fecha.slice(0, 10) === items[i + 1].fecha.slice(0, 10)
    ) {
      sospechosos.push(items[i], items[i + 1]);
    }
  }
  return sospechosos;
}

export function validarItems(
  items: ItemValidable[],
  opciones: OpcionesValidacion = {},
): ReporteValidacion {
  const { totalEsperado, toleranciaCantidad = 10 } = opciones;
  const warnings: Warning[] = [];
  const itemsDuplicados: PreviewItem[] = [];
  const itemsSospechosos: PreviewItem[] = [];

  const { items: mergedItems, mergedCount } = mergeSplitTransactions(items);
  const itemsMerged = mergedItems.filter(m =>
    !items.some(o => o.fecha === m.fecha && o.monto === m.monto && o.descripcion === m.descripcion)
  ).map(toPreviewItem);

  if (mergedCount > 0) {
    warnings.push({
      nivel: 'info', codigo: 'FUSION_AUTOMATICA',
      mensaje: `${mergedCount} fila${mergedCount > 1 ? 's' : ''} partida${mergedCount > 1 ? 's' : ''} fusionada${mergedCount > 1 ? 's' : ''} automáticamente.`,
      detalle: `Ej: ${itemsMerged.slice(0, 1).map(m => fmtGs(m.monto)).join(', ')}`,
    });
  }

  if (mergedItems.length === 0) {
    return {
      ok: false,
      warnings: [{ nivel: 'error', codigo: 'SIN_ITEMS', mensaje: 'No se encontraron transacciones.' }],
      estadisticas: {
        totalItems: 0, duplicadosDetectados: 0, itemsMontoRaro: 0,
        sumaIngresos: 0, sumaEgresos: 0, balanceNeto: 0, rangoFechas: null,
      },
      itemsDuplicados: [],
      itemsSospechosos: [],
        itemsMerged: [],
      mergedCount: 0,
      itemsFinal: [],
    };
  }

  if (totalEsperado != null) {
    const desvio = Math.abs(mergedItems.length - totalEsperado);
    const pct = (desvio / totalEsperado) * 100;

    if (mergedItems.length > totalEsperado) {
      const nivel: NivelWarning = pct > toleranciaCantidad ? 'warning' : 'info';
      warnings.push({
        nivel,
        codigo: 'CANTIDAD_MAYOR',
        mensaje: `Gemini detectó ${mergedItems.length} movimientos, el PDF tiene ${totalEsperado}.`,
        detalle: `Diferencia de ${desvio} (${pct.toFixed(0)}%). Pueden existir filas duplicadas o partidas.`,
      });
    } else if (mergedItems.length < totalEsperado) {
      const nivel: NivelWarning = pct > toleranciaCantidad ? 'warning' : 'info';
      warnings.push({
        nivel,
        codigo: 'CANTIDAD_MENOR',
        mensaje: `Gemini detectó ${mergedItems.length} movimientos, el PDF tiene ${totalEsperado}.`,
        detalle: `Faltan ${desvio} transacciones (${pct.toFixed(0)}% menos).`,
      });
    }
  } else if (mergedItems.length > 500) {
    warnings.push({
      nivel: 'warning', codigo: 'CANTIDAD_ALTA',
      mensaje: `Se detectaron ${mergedItems.length} movimientos — cantidad inusualmente alta.`,
      detalle: 'Revisá que no haya duplicados.',
    });
  }

  const seen = new Map<string, number>();
  for (const item of mergedItems) {
    const key = claveDedup(item);
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  const dupKeys = new Set([...seen.entries()].filter(([, v]) => v > 1).map(([k]) => k));
  const dups = mergedItems.filter(i => dupKeys.has(claveDedup(i))).map(toPreviewItem);
  itemsDuplicados.push(...dups);

  if (dups.length > 0) {
    warnings.push({
      nivel: 'warning', codigo: 'DUPLICADOS',
      mensaje: `Se detectaron ${dups.length} posibles movimientos duplicados.`,
      detalle: `Ej: ${dups.slice(0, 2).map(d => `"${d.descripcion.slice(0, 30)}" ${fmtGs(d.monto)}`).join(' / ')}`,
    });
  }

  const partidos = parecePartido(mergedItems).map(toPreviewItem);
  itemsSospechosos.push(...partidos);
  if (partidos.length > 0) {
    warnings.push({
      nivel: 'info', codigo: 'MONTOS_PARTIDOS',
      mensaje: `${partidos.length} montos partidos (pueden fusionarse automáticamente al procesar).`,
    });
  }

  const montosCero = mergedItems.filter(i => Math.abs(i.monto) < 10);
  if (montosCero.length > 0) {
    warnings.push({
      nivel: 'info', codigo: 'MONTOS_MINIMOS',
      mensaje: `${montosCero.length} movimiento${montosCero.length > 1 ? 's' : ''} con monto menor a Gs. 10.`,
      detalle: 'Pueden ser filas de encabezado o saldos mal parseados.',
    });
    itemsSospechosos.push(...montosCero.map(toPreviewItem));
  }

  const fechas = mergedItems
    .map(i => new Date(i.fecha))
    .filter(d => !isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());

  const rangoFechas =
    fechas.length >= 2
      ? { desde: fmtFecha(fechas[0].toISOString()), hasta: fmtFecha(fechas[fechas.length - 1].toISOString()) }
      : null;

  const ahora = Date.now();
  const futuras = mergedItems.filter(i => new Date(i.fecha).getTime() > ahora + 86400_000);
  if (futuras.length > 0) {
    warnings.push({
      nivel: 'info', codigo: 'FECHAS_FUTURAS',
      mensaje: `${futuras.length} movimiento${futuras.length > 1 ? 's' : ''} con fecha futura.`,
      detalle: `Revisá: ${futuras.slice(0, 2).map(f => fmtFecha(f.fecha)).join(', ')}`,
    });
  }

  const sumaIngresos = mergedItems
    .filter(i => i.monto > 0)
    .reduce((s, i) => s + i.monto, 0);
  const sumaEgresos = mergedItems
    .filter(i => i.monto < 0)
    .reduce((s, i) => s + i.monto, 0);
  const balanceNeto = sumaIngresos + sumaEgresos;

  return {
    ok: !warnings.some(w => w.nivel === 'error' || w.nivel === 'warning'),
    warnings,
    estadisticas: {
      totalItems: mergedItems.length,
      duplicadosDetectados: dups.length,
      itemsMontoRaro: partidos.length,
      sumaIngresos,
      sumaEgresos,
      balanceNeto,
      rangoFechas,
    },
    itemsDuplicados,
    itemsSospechosos,
    itemsMerged,
    mergedCount,
    itemsFinal: mergedItems.map(toPreviewItem),
  };
}
