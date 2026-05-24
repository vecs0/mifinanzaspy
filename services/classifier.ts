// services/classifier.ts — Motor de clasificación automática de transacciones
import { KEYWORDS_CLASIFICACION, CATEGORIA_POR_ID } from '@/constants/categories';
import { getReglas, insertRegla } from './database';
import type { ReglaClasificacion } from '@/types/finance';

// ─── Clasificación principal ─────────────────────────────────────

/**
 * Clasifica una transacción por su descripción y monto.
 * 1. Primero aplica reglas aprendidas del usuario (desde DB)
 * 2. Si no hay coincidencia, usa las palabras clave predefinidas
 * 3. Fallback: 'ingreso' si monto > 0, 'otros' si egreso
 *
 * @returns categoriaId — nunca lanza excepción
 */
export async function clasificarTransaccion(
  descripcion: string,
  monto: number
): Promise<string> {
  const texto = descripcion.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  // 1) Reglas aprendidas del usuario (más alta prioridad)
  const reglas = await getReglas();
  for (const regla of reglas) {
    if (regla.esRegex) {
      try {
        if (new RegExp(regla.patronTexto, 'i').test(texto)) {
          return regla.categoriaId;
        }
      } catch {
        // regex inválida — ignorar
      }
    } else {
      if (texto.includes(regla.patronTexto.toLowerCase())) {
        return regla.categoriaId;
      }
    }
  }

  // 2) Palabras clave predefinidas
  for (const [keyword, catId] of KEYWORDS_CLASIFICACION) {
    if (texto.includes(keyword.toLowerCase())) {
      return catId;
    }
  }

  // 3) Fallback por tipo de monto
  return monto > 0 ? 'salario' : 'otros';
}

/**
 * Versión síncrona (sin consultar DB) — para clasificación rápida en parseo de SMS.
 * Solo usa las palabras clave estáticas.
 */
export function clasificarSincrono(descripcion: string, monto: number): string {
  const texto = descripcion.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  for (const [keyword, catId] of KEYWORDS_CLASIFICACION) {
    if (texto.includes(keyword.toLowerCase())) {
      return catId;
    }
  }

  return monto > 0 ? 'salario' : 'otros';
}

/**
 * Aprende una nueva regla desde la corrección del usuario.
 * Guarda la regla en DB para futuras clasificaciones.
 */
export async function aprenderRegla(
  descripcion: string,
  categoriaId: string
): Promise<void> {
  // Extraemos las primeras 3+ palabras significativas como patrón
  const palabras = descripcion
    .toLowerCase()
    .split(/\s+/)
    .filter(p => p.length >= 3)
    .slice(0, 3);

  if (palabras.length === 0) return;

  const patron = palabras.join(' ').substring(0, 40);
  const regla: Omit<ReglaClasificacion, 'id'> = {
    patronTexto: patron,
    categoriaId,
    prioridad: 10, // Mayor que las predefinidas
    esRegex: false,
  };

  await insertRegla(regla);
}

// ─── Proyección de salud financiera ─────────────────────────────

export interface ResultadoProyeccion {
  pctGastado:       number;       // 0-100+
  saldoProyectado:  number;       // Estimado al fin de mes
  diasRestantes:    number;
  estadoSalud:      'estable' | 'atencion' | 'riesgo';
}

/**
 * Calcula la proyección financiera del mes actual.
 */
export function calcularProyeccion(
  ingresosMes: number,
  egresosMes: number,
  saldoActual: number
): ResultadoProyeccion {
  const hoy = new Date();
  const diasEnMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
  const diaActual = hoy.getDate();
  const diasRestantes = diasEnMes - diaActual;

  const pctGastado = ingresosMes > 0
    ? Math.round((egresosMes / ingresosMes) * 100)
    : (egresosMes > 0 ? 100 : 0);

  // Tasa diaria de gasto
  const gastoDiario = diaActual > 0 ? egresosMes / diaActual : 0;
  const gastoRestante = gastoDiario * diasRestantes;
  const saldoProyectado = saldoActual - gastoRestante;

  let estadoSalud: ResultadoProyeccion['estadoSalud'];
  if (pctGastado <= 70) {
    estadoSalud = 'estable';
  } else if (pctGastado <= 90) {
    estadoSalud = 'atencion';
  } else {
    estadoSalud = 'riesgo';
  }

  return { pctGastado, saldoProyectado, diasRestantes, estadoSalud };
}
