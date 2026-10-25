/**
 * archivo
 * Responsabilidad: Reglas puras del archivado de movimientos (marca normalizada, par de traspaso, ajuste de saldo al borrar, agrupacion de operaciones, orden y filtros)
 * Usado por: services/database.ts, services/backupService.ts, components/ArchivedSection.tsx, __tests__/archivo.test.ts
 * Depende de: services/dateKeys.ts
 */
import { storedDayKey } from './dateKeys';

export type FilaArchivo = {
  id: string;
  cuentaId: string;
  bancoId: string;
  monto: number;
  fecha: string;
  descripcion: string;
  esTraspaso: number | null;
  cuentaParId: string | null;
  archivado: number | null;
  archivadoEn: string | null;
};

export type CuentaArchivo = {
  id: string;
  alias: string;
  activa: boolean;
};

export type AjusteCuenta = {
  cuentaId: string;
  delta: number;
};

export type OperacionArchivo = {
  ids: string[];
  traspaso: boolean;
  ambiguo: boolean;
  ajustes: AjusteCuenta[];
};

export function normalizarArchivado(valor: unknown): 0 | 1 {
  return Number(valor) === 1 ? 1 : 0;
}

export function deltaSaldoAlBorrar(monto: number): number {
  return 0 - monto;
}

function esPata(fila: FilaArchivo): boolean {
  return fila.esTraspaso === 1 && fila.cuentaParId !== null;
}

function esContraparte(fila: FilaArchivo, candidata: FilaArchivo): boolean {
  return (
    candidata.id !== fila.id &&
    candidata.cuentaId === fila.cuentaParId &&
    candidata.cuentaParId === fila.cuentaId &&
    candidata.monto === 0 - fila.monto &&
    storedDayKey(candidata.fecha) === storedDayKey(fila.fecha)
  );
}

function ajusteDe(fila: FilaArchivo): AjusteCuenta {
  return { cuentaId: fila.cuentaId, delta: deltaSaldoAlBorrar(fila.monto) };
}

function sumarAjustes(ajustes: AjusteCuenta[]): AjusteCuenta[] {
  const salida: AjusteCuenta[] = [];
  for (const ajuste of ajustes) {
    const existente = salida.find((a) => a.cuentaId === ajuste.cuentaId);
    if (existente) existente.delta += ajuste.delta;
    else salida.push({ cuentaId: ajuste.cuentaId, delta: ajuste.delta });
  }
  return salida;
}

export function resolverOperacion(
  fila: FilaArchivo,
  candidatas: FilaArchivo[]
): OperacionArchivo {
  const ajuste = ajusteDe(fila);
  if (!esPata(fila)) {
    return { ids: [fila.id], traspaso: false, ambiguo: false, ajustes: [ajuste] };
  }
  const pares = candidatas.filter((c) => esContraparte(fila, c));
  if (pares.length === 0) {
    return { ids: [fila.id], traspaso: false, ambiguo: false, ajustes: [ajuste] };
  }
  if (pares.length > 1) {
    return { ids: [fila.id], traspaso: false, ambiguo: true, ajustes: [ajuste] };
  }
  const par = pares[0];
  return {
    ids: [fila.id, par.id],
    traspaso: true,
    ambiguo: false,
    ajustes: sumarAjustes([ajuste, ajusteDe(par)]),
  };
}

export function agruparOperaciones(filas: FilaArchivo[]): OperacionArchivo[] {
  const operaciones: OperacionArchivo[] = [];
  const usadas = new Set<string>();
  for (const fila of filas) {
    if (usadas.has(fila.id)) continue;
    const disponibles = filas.filter((c) => c.id !== fila.id && !usadas.has(c.id));
    const operacion = resolverOperacion(fila, disponibles);
    for (const id of operacion.ids) usadas.add(id);
    operaciones.push(operacion);
  }
  return operaciones;
}

export function ajustesPorCuenta(operaciones: OperacionArchivo[]): AjusteCuenta[] {
  const salida: AjusteCuenta[] = [];
  for (const operacion of operaciones) {
    for (const ajuste of sumarAjustes(operacion.ajustes)) {
      const existente = salida.find((a) => a.cuentaId === ajuste.cuentaId);
      if (existente) existente.delta += ajuste.delta;
      else salida.push({ cuentaId: ajuste.cuentaId, delta: ajuste.delta });
    }
  }
  return salida;
}

export function detalleAjustes(
  ajustes: AjusteCuenta[],
  cuentas: CuentaArchivo[]
): { cuentaId: string; alias: string; delta: number; activa: boolean }[] {
  return ajustes.map((ajuste) => {
    const cuenta = cuentas.find((c) => c.id === ajuste.cuentaId);
    return {
      cuentaId: ajuste.cuentaId,
      alias: cuenta ? cuenta.alias : ajuste.cuentaId,
      delta: ajuste.delta,
      activa: cuenta ? cuenta.activa : false,
    };
  });
}

export function horaDeFila(fecha: string): string {
  const separador = fecha.indexOf('T');
  if (separador < 0) return '00:00';
  const hora = fecha.slice(separador + 1, separador + 6);
  return /^\d{2}:\d{2}$/.test(hora) ? hora : '00:00';
}

export function ordenarArchivo(filas: FilaArchivo[]): FilaArchivo[] {
  return [...filas].sort((a, b) => {
    const diaA = storedDayKey(a.fecha);
    const diaB = storedDayKey(b.fecha);
    if (diaA !== diaB) return diaA < diaB ? 1 : -1;
    const horaA = horaDeFila(a.fecha);
    const horaB = horaDeFila(b.fecha);
    if (horaA !== horaB) return horaA < horaB ? 1 : -1;
    if (a.id === b.id) return 0;
    return a.id < b.id ? -1 : 1;
  });
}

export function filtrarArchivo(
  filas: FilaArchivo[],
  filtros: { cuentaId?: string; bancoId?: string }
): FilaArchivo[] {
  return filas.filter(
    (fila) =>
      (filtros.cuentaId === undefined || fila.cuentaId === filtros.cuentaId) &&
      (filtros.bancoId === undefined || fila.bancoId === filtros.bancoId)
  );
}
