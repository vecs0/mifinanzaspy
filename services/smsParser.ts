// services/smsParser.ts — Parseo de SMS bancarios paraguayos
// Usa los patrones de constants/smsPatterns.ts para extraer datos de transacción
// desde el texto crudo del SMS.
import {
  BANK_SMS_PATTERNS,
  detectarBancoPorRemitente,
  parsearMontoGuarani,
} from '@/constants/smsPatterns';
import { clasificarSincrono } from '@/services/classifier';
import { getCuentas } from '@/services/database';
import type { Transaccion, FuenteCaptura } from '@/types/finance';

// ─── Tipos internos ──────────────────────────────────────────────

export interface ResultadoParseoSMS {
  /** true si el SMS fue reconocido como bancario */
  reconocido:  boolean;
  bancoId:     string | null;
  cuentaId:    string | null;
  /** Parcial de Transaccion lista para insertTransaccion() */
  transaccion: Omit<Transaccion, 'id'> | null;
  /** Confianza del parseo: 'alta' | 'media' | 'baja' */
  confianza:   'alta' | 'media' | 'baja';
  /** Razón de rechazo si reconocido === false */
  razon:       string | null;
}

// ─── Función principal ───────────────────────────────────────────

/**
 * Parsea un SMS bancario y retorna un ResultadoParseoSMS.
 *
 * @param remitente  Campo "From" del SMS (ej: "ITAU", "37828")
 * @param cuerpo     Cuerpo completo del SMS
 * @param fechaSMS   Timestamp del SMS (milisegundos Unix o ISO string)
 */
export async function parsearSMS(
  remitente: string,
  cuerpo: string,
  fechaSMS: number | string,
): Promise<ResultadoParseoSMS> {
  // 1. Identificar banco por remitente
  const bancoId = detectarBancoPorRemitente(remitente);
  if (!bancoId) {
    return {
      reconocido: false, bancoId: null, cuentaId: null,
      transaccion: null, confianza: 'baja',
      razon: `Remitente no reconocido: "${remitente}"`,
    };
  }

  const patron = BANK_SMS_PATTERNS[bancoId];
  if (!patron) {
    return {
      reconocido: false, bancoId, cuentaId: null,
      transaccion: null, confianza: 'baja',
      razon: `Sin patrón SMS para banco: ${bancoId}`,
    };
  }

  // 2. Extraer monto y tipo de transacción
  let monto:  number | null = null;
  let tipo:   'debito' | 'credito' | 'transferencia' = 'debito';

  const matchDebito  = patron.regexDebito?.exec(cuerpo);
  const matchCredito = patron.regexCredito?.exec(cuerpo);

  if (matchDebito) {
    monto = parsearMontoGuarani(matchDebito[1]);
    tipo  = 'debito';
  } else if (matchCredito) {
    monto = parsearMontoGuarani(matchCredito[1]);
    tipo  = 'credito';
  }

  // Detectar transferencias por palabras clave comunes
  const esTransferencia = /transfer|transf\.|enviaste|enviado|recibiste de/i.test(cuerpo);
  if (esTransferencia && monto !== null) {
    tipo = 'transferencia';
  }

  if (monto === null || isNaN(monto) || monto <= 0) {
    return {
      reconocido: true, bancoId, cuentaId: null,
      transaccion: null, confianza: 'baja',
      razon: 'No se pudo extraer un monto válido del SMS',
    };
  }

  // 3. Extraer saldo posterior (opcional)
  let saldoPost: number | null = null;
  if (patron.regexSaldo) {
    const matchSaldo = patron.regexSaldo.exec(cuerpo);
    if (matchSaldo) {
      saldoPost = parsearMontoGuarani(matchSaldo[1]);
    }
  }

  // 4. Extraer descripción / comercio
  let descripcion = '';
  if (patron.regexComercio) {
    const matchComercio = patron.regexComercio.exec(cuerpo);
    if (matchComercio) {
      descripcion = matchComercio[1].trim();
    }
  }
  if (!descripcion) {
    // Fallback: primer fragmento no-numérico del cuerpo (hasta 40 chars)
    descripcion = cuerpo
      .replace(/Gs\.?\s*[\d.,]+/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim()
      .slice(0, 40);
  }

  // 5. Buscar la cuenta correspondiente al banco
  let cuentaId: string | null = null;
  let bancoIdCuenta = bancoId;
  try {
    const cuentas = await getCuentas();
    const cuenta  = cuentas.find(c => c.bancoId === bancoId && c.activa);
    if (cuenta) {
      cuentaId      = cuenta.id;
      bancoIdCuenta = cuenta.bancoId;
    }
  } catch {
    // En módulo nativo puede no tener acceso a DB todavía — se asigna después
  }

  if (!cuentaId) {
    return {
      reconocido: true, bancoId, cuentaId: null,
      transaccion: null, confianza: 'media',
      razon: `Banco reconocido (${bancoId}) pero sin cuenta configurada`,
    };
  }

  // 6. Clasificar categoría automáticamente
  const categoriaId = clasificarSincrono(descripcion, tipo === 'credito' ? monto : -monto);

  // 7. Montar transacción parcial
  const fecha = typeof fechaSMS === 'number'
    ? new Date(fechaSMS).toISOString()
    : new Date(fechaSMS).toISOString();

  const montoFinal = tipo === 'credito' ? Math.abs(monto) : -Math.abs(monto);

  const transaccion: Omit<Transaccion, 'id'> = {
    cuentaId,
    bancoId:    bancoIdCuenta,
    monto:      montoFinal,
    tipo,
    categoriaId,
    descripcion,
    fuente:     'sms' as FuenteCaptura,
    fecha,
    saldoPost,
    smsRaw:     cuerpo,
    procesado:  false,
    notas:      null,
  };

  // Determinar nivel de confianza
  const confianza: ResultadoParseoSMS['confianza'] =
    descripcion.length > 3 && saldoPost !== null ? 'alta' :
    descripcion.length > 3                        ? 'media' :
                                                    'baja';

  return {
    reconocido: true, bancoId, cuentaId,
    transaccion, confianza, razon: null,
  };
}

// ─── Variante síncrona (sin acceso a DB) ────────────────────────
// Útil en el módulo nativo donde no se puede usar async/await de DB
// directamente. Retorna la transacción sin cuentaId — el llamador
// debe asignarlo.

export function parsearSMSSincrono(
  remitente: string,
  cuerpo: string,
  fechaSMS: number | string,
  cuentaId: string,
  bancoIdOverride?: string,
): Omit<Transaccion, 'id'> | null {
  const bancoId = bancoIdOverride ?? detectarBancoPorRemitente(remitente);
  if (!bancoId) return null;

  const patron = BANK_SMS_PATTERNS[bancoId];
  if (!patron)  return null;

  let monto: number | null = null;
  let tipo: 'debito' | 'credito' | 'transferencia' = 'debito';

  const matchDebito  = patron.regexDebito?.exec(cuerpo);
  const matchCredito = patron.regexCredito?.exec(cuerpo);

  if (matchDebito) {
    monto = parsearMontoGuarani(matchDebito[1]);
    tipo  = 'debito';
  } else if (matchCredito) {
    monto = parsearMontoGuarani(matchCredito[1]);
    tipo  = 'credito';
  }

  if (!monto || isNaN(monto) || monto <= 0) return null;

  const esTransferencia = /transfer|transf\.|enviaste|enviado|recibiste de/i.test(cuerpo);
  if (esTransferencia) tipo = 'transferencia';

  let saldoPost: number | null = null;
  if (patron.regexSaldo) {
    const m = patron.regexSaldo.exec(cuerpo);
    if (m) saldoPost = parsearMontoGuarani(m[1]);
  }

  let descripcion = '';
  if (patron.regexComercio) {
    const m = patron.regexComercio.exec(cuerpo);
    if (m) descripcion = m[1].trim();
  }
  if (!descripcion) {
    descripcion = cuerpo.replace(/Gs\.?\s*[\d.,]+/gi, '').replace(/\s{2,}/g, ' ').trim().slice(0, 40);
  }

  const categoriaId = clasificarSincrono(descripcion, tipo === 'credito' ? monto : -monto);
  const fecha = typeof fechaSMS === 'number'
    ? new Date(fechaSMS).toISOString()
    : new Date(fechaSMS).toISOString();

  return {
    cuentaId,
    bancoId,
    monto:      tipo === 'credito' ? Math.abs(monto) : -Math.abs(monto),
    tipo,
    categoriaId,
    descripcion,
    fuente:     'sms',
    fecha,
    saldoPost,
    smsRaw:     cuerpo,
    procesado:  false,
    notas:      null,
  };
}

// ─── Filtro rápido: ¿es este SMS bancario? ──────────────────────
// Llamado desde el BroadcastReceiver antes de procesar completo.

export function esSMSBancario(remitente: string, cuerpo: string): boolean {
  if (detectarBancoPorRemitente(remitente)) return true;
  // Heurística de respaldo: el cuerpo menciona "Gs" y tiene dígitos
  return /\bGs\.?\s*[\d.,]{3,}/i.test(cuerpo);
}
