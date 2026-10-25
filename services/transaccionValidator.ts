/**
 * transaccionValidator
 * Responsabilidad: Validacion y fusion no destructiva de transacciones importadas
 * Usado por: ValidationBanner, ResultsScreen, comprobante, __tests__/transaccionValidator.test.ts
 * Depende de: importService (tipos), dateKeys, verificacion
 */
import type { PreviewItem } from '@/services/importService';
import { localDateKey, storedDayKey } from './dateKeys';
import { formatearDia } from './verificacion';
import type { Fusion } from './verificacion';

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

function toPreviewItem(item: ItemValidable): PreviewItem {
  return { ...item, tipo: item.monto >= 0 ? 'credito' : 'debito', categoriaId: 'otros' };
}

function claveDedup(item: ItemValidable): string {
  const fecha = storedDayKey(item.fecha);
  const desc = item.descripcion
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40);
  return `${fecha}|${item.monto}|${desc}`;
}

function mismaFecha(a: ItemValidable, b: ItemValidable): boolean {
  return storedDayKey(a.fecha) === storedDayKey(b.fecha);
}

function mismoSigno(a: ItemValidable, b: ItemValidable): boolean {
  return (a.monto > 0 && b.monto > 0) || (a.monto < 0 && b.monto < 0);
}

function parecePartido(a: ItemValidable, b: ItemValidable): boolean {
  if (!mismaFecha(a, b) || !mismoSigno(a, b)) return false;
  const concatenado = parseInt(`${Math.abs(a.monto)}${Math.abs(b.monto)}`, 10);
  return concatenado > 100_000 && concatenado % 1000 === 0;
}

function ordenarPorDiaYMonto(items: ItemValidable[]): ItemValidable[] {
  return [...items].sort((a, b) => {
    const dia = storedDayKey(a.fecha).localeCompare(storedDayKey(b.fecha));
    if (dia !== 0) return dia;
    return Math.abs(a.monto) - Math.abs(b.monto);
  });
}

export function mergeSplitTransactions(items: ItemValidable[]): {
  items: ItemValidable[];
  mergedCount: number;
  fusiones: Fusion[];
} {
  const ordenados = ordenarPorDiaYMonto(items);
  const fusionados = new Set<number>();
  const resultado: ItemValidable[] = [];
  const fusiones: Fusion[] = [];
  let mergedCount = 0;

  for (let i = 0; i < ordenados.length; i++) {
    if (fusionados.has(i)) continue;
    let actual = ordenados[i];
    for (let j = i + 1; j < ordenados.length; j++) {
      if (fusionados.has(j)) continue;
      const candidato = ordenados[j];
      if (!mismaFecha(actual, candidato)) break;
      if (!parecePartido(actual, candidato)) continue;
      const fusionada: ItemValidable = {
        ...actual,
        monto: actual.monto + candidato.monto,
        descripcion: `${actual.descripcion} / ${candidato.descripcion}`,
      };
      fusiones.push({ fusionada, originales: [actual, candidato] });
      actual = fusionada;
      fusionados.add(j);
      mergedCount++;
    }
    resultado.push(actual);
  }

  return { items: resultado, mergedCount, fusiones };
}

function parecePartidoSuelto(items: ItemValidable[]): ItemValidable[] {
  const sospechosos: ItemValidable[] = [];
  for (let i = 0; i < items.length - 1; i++) {
    if (parecePartido(items[i], items[i + 1])) {
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

  const leidas = items.length;
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
    const desvio = Math.abs(leidas - totalEsperado);
    const pct = (desvio / totalEsperado) * 100;

    if (leidas > totalEsperado) {
      const nivel: NivelWarning = pct > toleranciaCantidad ? 'warning' : 'info';
      warnings.push({
        nivel,
        codigo: 'CANTIDAD_MAYOR',
        mensaje: `Gemini detectó ${leidas} movimientos, el PDF tiene ${totalEsperado}.`,
        detalle: `Diferencia de ${desvio} (${pct.toFixed(0)}%). Pueden existir filas duplicadas o partidas.`,
      });
    } else if (leidas < totalEsperado) {
      const nivel: NivelWarning = pct > toleranciaCantidad ? 'warning' : 'info';
      warnings.push({
        nivel,
        codigo: 'CANTIDAD_MENOR',
        mensaje: `Gemini detectó ${leidas} movimientos, el PDF tiene ${totalEsperado}.`,
        detalle: `Faltan ${desvio} transacciones (${pct.toFixed(0)}% menos).`,
      });
    }
  } else if (leidas > 500) {
    warnings.push({
      nivel: 'warning', codigo: 'CANTIDAD_ALTA',
      mensaje: `Se detectaron ${leidas} movimientos — cantidad inusualmente alta.`,
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

  const partidos = parecePartidoSuelto(mergedItems).map(toPreviewItem);
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

  const dias = mergedItems
    .map(i => storedDayKey(i.fecha))
    .filter(dia => /^\d{4}-\d{2}-\d{2}$/.test(dia))
    .sort();

  const rangoFechas =
    dias.length >= 2
      ? { desde: formatearDia(dias[0]), hasta: formatearDia(dias[dias.length - 1]) }
      : null;

  const hoy = localDateKey();
  const futuras = mergedItems.filter(i => storedDayKey(i.fecha) > hoy);
  if (futuras.length > 0) {
    warnings.push({
      nivel: 'info', codigo: 'FECHAS_FUTURAS',
      mensaje: `${futuras.length} movimiento${futuras.length > 1 ? 's' : ''} con fecha futura.`,
      detalle: `Revisá: ${futuras.slice(0, 2).map(f => formatearDia(f.fecha)).join(', ')}`,
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
