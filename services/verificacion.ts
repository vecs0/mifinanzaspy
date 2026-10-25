/**
 * verificacion
 * Responsabilidad: Funciones puras de la verificacion previa a guardar (comparacion de cantidades y saldos, totales y rango, anomalias con accion, estado, constancia y clasificacion de duplicados)
 * Usado por: services/transaccionValidator.ts, app/comprobante.tsx, components/comprobante/VerificationScreen.tsx, __tests__/verificacion.test.ts
 * Depende de: services/dateKeys.ts, services/archivo.ts, services/transaccionValidator.ts (solo tipos)
 */
import type { ItemValidable } from './transaccionValidator';
import { normalizarArchivado } from './archivo';
import { localDateKey, localDateTimeKey, storedDayKey } from './dateKeys';

export type OrigenCarga = 'foto' | 'galeria' | 'pdf' | 'csv' | 'lote';

export type ItemVerificacion = {
  id: string;
  monto: number;
  fecha: string;
  descripcion: string;
  fechaAsumida?: boolean;
  hash?: string;
};

export type Fusion = {
  fusionada: ItemValidable;
  originales: [ItemValidable, ItemValidable];
};

export type MetadatosDeclarados = {
  cantidadDeclarada?: number;
  saldoInicial?: number;
  saldoFinal?: number;
  banco?: string;
  archivos?: {
    nombre: string;
    cantidadDeclarada?: number;
    saldoInicial?: number;
    saldoFinal?: number;
    banco?: string;
  }[];
};

export type ComparacionCantidad = {
  declarada: number | null;
  leida: number;
  diferencia: number | null;
  hayDatoDeclarado: boolean;
};

export type ComparacionSaldos = {
  inicial: number | null;
  calculado: number | null;
  final: number | null;
  diferencia: number | null;
  evaluable: boolean;
};

export type AnomaliaTipo =
  | 'duplicado_archivo'
  | 'montos_partidos'
  | 'monto_minimo'
  | 'fecha_futura'
  | 'fecha_asumida'
  | 'diferencia_cantidad'
  | 'diferencia_saldo';

export type AccionAnomalia =
  | 'quitar'
  | 'fusionar'
  | 'editar_monto'
  | 'editar_fecha'
  | 'agregar_movimiento'
  | 'editar_fila';

export type Anomalia = {
  tipo: AnomaliaTipo;
  severidad: 'info' | 'atencion';
  mensaje: string;
  accion: AccionAnomalia;
  refs: string[];
};

export type EstadoVerificacion = 'guardar' | 'guardar_con_observacion';

export type ResultadoVerificacion = {
  estado: EstadoVerificacion;
  cantidad: ComparacionCantidad;
  saldos: ComparacionSaldos;
  totales: {
    ingresos: number;
    egresos: number;
    neto: number;
    desde: string | null;
    hasta: string | null;
    banco: string | null;
  };
  anomalias: Anomalia[];
  fusiones: Fusion[];
};

export type ExistenteHash = { hash: string; id: string; archivado: number };

export type ClasificacionDuplicados = {
  nuevas: ItemVerificacion[];
  yaCargadas: ItemVerificacion[];
  yaCargadasArchivadas: ItemVerificacion[];
};

const DIA_VALIDO = /^\d{4}-\d{2}-\d{2}$/;

export function formatearGuaranies(n: number): string {
  const valor = Math.round(n);
  const digitos = Math.abs(valor).toString();
  const conSeparador = digitos.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return valor < 0 ? `-${conSeparador}` : conSeparador;
}

function fmtGs(n: number): string {
  return `Gs. ${formatearGuaranies(n)}`;
}

export function formatearDia(fecha: string): string {
  const partes = storedDayKey(fecha).split('-');
  if (partes.length !== 3) return fecha;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

export function rangoFechas(
  items: { fecha: string }[]
): { desde: string; hasta: string } | null {
  const claves = items
    .map(i => storedDayKey(i.fecha))
    .filter(k => DIA_VALIDO.test(k));
  if (claves.length === 0) return null;
  let desde = claves[0];
  let hasta = claves[0];
  for (const clave of claves) {
    if (clave < desde) desde = clave;
    if (clave > hasta) hasta = clave;
  }
  return { desde: formatearDia(desde), hasta: formatearDia(hasta) };
}

export function compararCantidad(
  declarada: number | undefined,
  leidas: number
): ComparacionCantidad {
  if (declarada === undefined || declarada === null || !Number.isFinite(declarada)) {
    return { declarada: null, leida: leidas, diferencia: null, hayDatoDeclarado: false };
  }
  return {
    declarada,
    leida: leidas,
    diferencia: leidas - declarada,
    hayDatoDeclarado: true,
  };
}

export function compararSaldos(
  inicial: number | undefined,
  final: number | undefined,
  items: { monto: number }[]
): ComparacionSaldos {
  const consignaInicial =
    inicial === undefined || inicial === null || !Number.isFinite(inicial) ? null : inicial;
  const consignaFinal =
    final === undefined || final === null || !Number.isFinite(final) ? null : final;
  const calculado =
    consignaInicial === null
      ? null
      : consignaInicial + items.reduce((s, i) => s + i.monto, 0);
  const evaluable = calculado !== null && consignaFinal !== null;
  return {
    inicial: consignaInicial,
    calculado,
    final: consignaFinal,
    diferencia: evaluable ? consignaFinal - calculado : null,
    evaluable,
  };
}

export function calcularTotales(
  items: { monto: number; fecha: string }[],
  banco?: string
): ResultadoVerificacion['totales'] {
  let ingresos = 0;
  let egresos = 0;
  for (const item of items) {
    if (item.monto > 0) ingresos += item.monto;
    else if (item.monto < 0) egresos += -item.monto;
  }
  const rango = rangoFechas(items);
  return {
    ingresos,
    egresos,
    neto: ingresos - egresos,
    desde: rango ? rango.desde : null,
    hasta: rango ? rango.hasta : null,
    banco: banco ?? null,
  };
}

export function clasificarDuplicados(
  items: ItemVerificacion[],
  existentes: ExistenteHash[]
): ClasificacionDuplicados {
  const porHash = new Map<string, ExistenteHash[]>();
  for (const existente of existentes) {
    const lista = porHash.get(existente.hash);
    if (lista) lista.push(existente);
    else porHash.set(existente.hash, [existente]);
  }
  const nuevas: ItemVerificacion[] = [];
  const yaCargadas: ItemVerificacion[] = [];
  const yaCargadasArchivadas: ItemVerificacion[] = [];
  for (const item of items) {
    const coincidencias = item.hash ? porHash.get(item.hash) ?? [] : [];
    if (coincidencias.length === 0) {
      nuevas.push(item);
    } else if (coincidencias.some(e => normalizarArchivado(e.archivado) !== 1)) {
      yaCargadas.push(item);
    } else {
      yaCargadasArchivadas.push(item);
    }
  }
  return { nuevas, yaCargadas, yaCargadasArchivadas };
}

function esPartido(a: ItemVerificacion, b: ItemVerificacion): boolean {
  if (storedDayKey(a.fecha) !== storedDayKey(b.fecha)) return false;
  if (!((a.monto > 0 && b.monto > 0) || (a.monto < 0 && b.monto < 0))) return false;
  const concatenado = parseInt(`${Math.abs(a.monto)}${Math.abs(b.monto)}`, 10);
  return concatenado > 100_000 && concatenado % 1000 === 0;
}

function esResultadoDeFusion(item: ItemVerificacion, fusiones: Fusion[]): boolean {
  return fusiones.some(
    f =>
      f.fusionada.monto === item.monto &&
      f.fusionada.descripcion === item.descripcion &&
      storedDayKey(f.fusionada.fecha) === storedDayKey(item.fecha)
  );
}

function paresPartidos(items: ItemVerificacion[], fusiones: Fusion[]): [ItemVerificacion, ItemVerificacion][] {
  const candidatos = items.filter(item => !esResultadoDeFusion(item, fusiones));
  const ordenados = [...candidatos].sort((a, b) => {
    const dia = storedDayKey(a.fecha).localeCompare(storedDayKey(b.fecha));
    if (dia !== 0) return dia;
    return Math.abs(a.monto) - Math.abs(b.monto);
  });
  const pares: [ItemVerificacion, ItemVerificacion][] = [];
  for (let i = 0; i < ordenados.length - 1; i++) {
    if (esPartido(ordenados[i], ordenados[i + 1])) {
      pares.push([ordenados[i], ordenados[i + 1]]);
    }
  }
  return pares;
}

export function detectarAnomalias(entrada: {
  items: ItemVerificacion[];
  leidas: number;
  fusiones: Fusion[];
  cantidad: ComparacionCantidad;
  saldos: ComparacionSaldos;
  duplicadosArchivo: string[];
  hoy: string;
}): Anomalia[] {
  const { items, fusiones, cantidad, saldos, duplicadosArchivo, hoy } = entrada;
  const anomalias: Anomalia[] = [];

  if (duplicadosArchivo.length > 0) {
    anomalias.push({
      tipo: 'duplicado_archivo',
      severidad: 'atencion',
      mensaje: `Hay ${duplicadosArchivo.length} movimiento${
        duplicadosArchivo.length > 1 ? 's' : ''
      } con los mismos datos dentro del archivo: parecen duplicados.`,
      accion: 'quitar',
      refs: [...duplicadosArchivo],
    });
  }

  for (const par of paresPartidos(items, fusiones)) {
    anomalias.push({
      tipo: 'montos_partidos',
      severidad: 'info',
      mensaje: `Los montos ${fmtGs(par[0].monto)} y ${fmtGs(par[1].monto)} parecen ser una sola fila partida.`,
      accion: 'fusionar',
      refs: [par[0].id, par[1].id],
    });
  }

  for (const item of items) {
    if (item.monto !== 0 && Math.abs(item.monto) < 10) {
      anomalias.push({
        tipo: 'monto_minimo',
        severidad: 'info',
        mensaje: 'El monto es menor a Gs. 10; puede ser una fila de encabezado o de saldos.',
        accion: 'editar_monto',
        refs: [item.id],
      });
    }
  }

  for (const item of items) {
    if (hoy !== '' && storedDayKey(item.fecha) > hoy) {
      anomalias.push({
        tipo: 'fecha_futura',
        severidad: 'info',
        mensaje: 'Este movimiento tiene una fecha posterior a hoy.',
        accion: 'editar_fecha',
        refs: [item.id],
      });
    }
  }

  for (const item of items) {
    if (item.fechaAsumida === true) {
      anomalias.push({
        tipo: 'fecha_asumida',
        severidad: 'atencion',
        mensaje: 'El documento no tiene fecha para este movimiento: se asumió la de hoy.',
        accion: 'editar_fecha',
        refs: [item.id],
      });
    }
  }

  if (cantidad.diferencia !== null && cantidad.diferencia !== 0) {
    const desvio = Math.abs(cantidad.diferencia);
    if (cantidad.diferencia < 0) {
      anomalias.push({
        tipo: 'diferencia_cantidad',
        severidad: 'atencion',
        mensaje: `El documento declara ${cantidad.declarada} movimientos y leíste ${cantidad.leida}: faltan ${desvio} filas.`,
        accion: 'agregar_movimiento',
        refs: [],
      });
    } else {
      anomalias.push({
        tipo: 'diferencia_cantidad',
        severidad: 'atencion',
        mensaje: `El documento declara ${cantidad.declarada} movimientos y leíste ${cantidad.leida}: sobran ${desvio} filas.`,
        accion: 'quitar',
        refs: [],
      });
    }
  }

  if (saldos.evaluable && saldos.diferencia !== null && saldos.diferencia !== 0) {
    anomalias.push({
      tipo: 'diferencia_saldo',
      severidad: 'atencion',
      mensaje: `El saldo calculado es ${fmtGs(saldos.calculado ?? 0)} y el documento declara ${fmtGs(
        saldos.final ?? 0
      )}: diferencia ${fmtGs(saldos.diferencia)}. Puede faltar o sobrar un movimiento.`,
      accion: saldos.diferencia > 0 ? 'agregar_movimiento' : 'editar_monto',
      refs: [],
    });
  }

  return anomalias;
}

function claveDuplicado(item: ItemVerificacion): string {
  const dia = storedDayKey(item.fecha);
  const desc = item.descripcion.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 40);
  return `${dia}|${item.monto}|${desc}`;
}

function idsDuplicadosDelArchivo(items: ItemVerificacion[]): string[] {
  const conteo = new Map<string, number>();
  for (const item of items) {
    const clave = claveDuplicado(item);
    conteo.set(clave, (conteo.get(clave) ?? 0) + 1);
  }
  const vistos = new Set<string>();
  const copias: string[] = [];
  for (const item of items) {
    const clave = claveDuplicado(item);
    if ((conteo.get(clave) ?? 0) < 2) continue;
    if (vistos.has(clave)) copias.push(item.id);
    else vistos.add(clave);
  }
  return copias;
}

function cantidadDeclaradaDe(metadatos: MetadatosDeclarados): number | undefined {
  if (metadatos.cantidadDeclarada !== undefined && metadatos.cantidadDeclarada !== null) {
    return metadatos.cantidadDeclarada;
  }
  const archivos = metadatos.archivos ?? [];
  const queDeclaran = archivos.filter(
    a => a.cantidadDeclarada !== undefined && a.cantidadDeclarada !== null
  );
  if (queDeclaran.length === 0) return undefined;
  return queDeclaran.reduce((s, a) => s + (a.cantidadDeclarada ?? 0), 0);
}

export function construirVerificacion(entrada: {
  items: ItemVerificacion[];
  leidas: number;
  fusiones: Fusion[];
  metadatos: MetadatosDeclarados;
  existentes: ExistenteHash[];
  hoy: string;
  origen: OrigenCarga;
}): ResultadoVerificacion {
  const { items, leidas, fusiones, metadatos, existentes, hoy, origen } = entrada;
  const cantidad = compararCantidad(cantidadDeclaradaDe(metadatos), leidas);
  const saldos =
    origen === 'csv'
      ? compararSaldos(undefined, undefined, items)
      : compararSaldos(metadatos.saldoInicial, metadatos.saldoFinal, items);
  const totales = calcularTotales(items, metadatos.banco);
  const duplicadosArchivo = idsDuplicadosDelArchivo(items);
  const anomalias = detectarAnomalias({
    items,
    leidas,
    fusiones,
    cantidad,
    saldos,
    duplicadosArchivo,
    hoy,
  });
  const clasificacion = clasificarDuplicados(items, existentes);
  const hayDuplicadosBase =
    clasificacion.yaCargadas.length > 0 || clasificacion.yaCargadasArchivadas.length > 0;
  const conObservacion =
    (cantidad.diferencia !== null && cantidad.diferencia !== 0) ||
    (saldos.evaluable && saldos.diferencia !== null && saldos.diferencia !== 0) ||
    duplicadosArchivo.length > 0 ||
    hayDuplicadosBase ||
    anomalias.length > 0;
  return {
    estado: conObservacion ? 'guardar_con_observacion' : 'guardar',
    cantidad,
    saldos,
    totales,
    anomalias,
    fusiones: [...fusiones],
  };
}

export function selloVerificacion(ahora: Date): string {
  return localDateTimeKey(ahora);
}

export function textoConstancia(
  resultado: ResultadoVerificacion,
  sello: string
): string | null {
  if (resultado.estado === 'guardar') return null;
  const cantidad = resultado.cantidad;
  const partes = [
    cantidad.declarada === null ? 'declaradas sin dato' : `declaradas ${cantidad.declarada}`,
    `leídas ${cantidad.leida}`,
  ];
  if (resultado.saldos.evaluable) {
    partes.push(
      `saldo declarado ${fmtGs(resultado.saldos.final ?? 0)}`,
      `calculado ${fmtGs(resultado.saldos.calculado ?? 0)}`,
      `diferencia ${fmtGs(resultado.saldos.diferencia ?? 0)}`
    );
  } else {
    partes.push('saldos no declarados');
  }
  return `[Verificación ${sello.replace('T', ' ')}] ${partes.join(' \u00b7 ')}`;
}

export function agregarConstancia(nota: string | null, constancia: string): string {
  if (nota === null) return constancia;
  const previa = nota.replace(/\s+$/, '');
  if (previa === '') return constancia;
  return `${previa}\n${constancia}`;
}

export function marcarFechasAsumidas(
  items: ItemVerificacion[],
  hoy: string = localDateKey()
): ItemVerificacion[] {
  return items.map(item => {
    if (item.fecha && item.fecha.length > 0) return item;
    return { ...item, fecha: hoy, fechaAsumida: true };
  });
}

export function limpiarFechaAsumida(item: ItemVerificacion): ItemVerificacion {
  const copia: ItemVerificacion = { ...item };
  delete copia.fechaAsumida;
  return copia;
}
