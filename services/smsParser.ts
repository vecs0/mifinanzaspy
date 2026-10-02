/**
 * smsParser
 * Responsabilidad: Parseo de SMS bancarios paraguayos (7 pasos: identificar banco,
 *   extraer monto/tipo, saldo posterior, descripcion, buscar cuenta, clasificar, montar)
 * Usado por: smsService (interno)
 * Depende de: classifier, database, smsPatterns
 * Llamado desde el BroadcastReceiver antes de procesar completo (esSMSBancario)
 */
import {
  BANK_SMS_PATTERNS,
  detectarBancoPorRemitente,
  parsearMontoGuarani,
} from '@/constants/smsPatterns';
import { clasificarSincrono } from '@/services/classifier';
import { getCuentas } from '@/services/database';
import type { Transaccion, FuenteCaptura } from '@/types/finance';

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

  const esTransferencia = /transfer|transf\.|enviaste|enviado|recibiste de/i.test(cuerpo);
  if (esTransferencia && monto !== null) {
    const esEntrada = /recibiste|recibido|ingreso/i.test(cuerpo);
    const esSalida = /enviaste|enviado|salida/i.test(cuerpo);
    if (esEntrada) {
      tipo = 'credito';
    } else if (esSalida) {
      tipo = 'debito';
    } else {
      tipo = 'transferencia';
    }
  }

  if (monto === null || isNaN(monto) || monto <= 0) {
    return {
      reconocido: true, bancoId, cuentaId: null,
      transaccion: null, confianza: 'baja',
      razon: 'No se pudo extraer un monto válido del SMS',
    };
  }


  let saldoPost: number | null = null;
  if (patron.regexSaldo) {
    const matchSaldo = patron.regexSaldo.exec(cuerpo);
    if (matchSaldo) {
      saldoPost = parsearMontoGuarani(matchSaldo[1]);
    }
  }


  let descripcion = '';
  if (patron.regexComercio) {
    const matchComercio = patron.regexComercio.exec(cuerpo);
    if (matchComercio) {
      descripcion = matchComercio[1].trim();
    }
  }
  if (!descripcion) {

    descripcion = cuerpo
      .replace(/Gs\.?\s*[\d.,]+/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim()
      .slice(0, 40);
  }


  let cuentaId: string | null = null;
  let bancoIdCuenta = bancoId;
  try {
    const cuentas = await getCuentas();
    const cuenta  = cuentas.find(c => c.bancoId === bancoId && c.activa);
    if (cuenta) {
      cuentaId      = cuenta.id;
      bancoIdCuenta = cuenta.bancoId;
    }
  } catch (e) {
    console.warn('[smsParser] Error buscando cuenta en DB:', e);
  }

  if (!cuentaId) {
    return {
      reconocido: true, bancoId, cuentaId: null,
      transaccion: null, confianza: 'media',
      razon: `Banco reconocido (${bancoId}) pero sin cuenta configurada`,
    };
  }


  const categoriaId = clasificarSincrono(descripcion, tipo === 'credito' ? monto : -monto);

  const p = (n: number) => String(n).padStart(2, '0');
  const d = typeof fechaSMS === 'number' ? new Date(fechaSMS) : new Date(fechaSMS);
  const fecha = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;

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
    adjunto:    null,
    notas:      null,
  };


  const confianza: ResultadoParseoSMS['confianza'] =
    descripcion.length > 3 && saldoPost !== null ? 'alta' :
    descripcion.length > 3                        ? 'media' :
                                                    'baja';

  return {
    reconocido: true, bancoId, cuentaId,
    transaccion, confianza, razon: null,
  };
}



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
  if (esTransferencia) {
    const esEntrada = /recibiste|recibido|ingreso/i.test(cuerpo);
    const esSalida = /enviaste|enviado|salida/i.test(cuerpo);
    if (esEntrada) tipo = 'credito';
    else if (esSalida) tipo = 'debito';
    else tipo = 'transferencia';
  }

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
  const p = (n: number) => String(n).padStart(2, '0');
  const d = typeof fechaSMS === 'number' ? new Date(fechaSMS) : new Date(fechaSMS);
  const fecha = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;

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
    adjunto:    null,
  };
}


export function esSMSBancario(remitente: string, cuerpo: string): boolean {
  if (detectarBancoPorRemitente(remitente)) return true;

  return /\bGs\.?\s*[\d.,]{3,}/i.test(cuerpo);
}
