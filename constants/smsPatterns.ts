// constants/smsPatterns.ts — Regex calibradas para SMS bancarios paraguayos
// NOTA: Estos patrones son una primera versión. Deben calibrarse con SMS reales
// de cada banco durante la Fase 2 del proyecto.
import type { PatronSMSBanco } from '@/types/finance';

export const BANK_SMS_PATTERNS: Record<string, PatronSMSBanco> = {
  itau: {
    remitentes: ['ITAU', 'Itaú', '37828'],
    regexDebito:   /[Dd]ébit[o]?\s+Gs\.?\s*([\d.,]+)/,
    regexCredito:  /[Cc]rédit[o]?\s+Gs\.?\s*([\d.,]+)/,
    regexSaldo:    /[Ss]aldo\s*:?\s*Gs\.?\s*([\d.,]+)/,
    regexComercio: /en\s+(.+?)(?:\.|$)/,
  },
  continental: {
    remitentes: ['CONTINENTAL', '60056'],
    regexDebito:   /[Cc]ompra\s+Gs\s*([\d.,]+)/,
    regexCredito:  /[Aa]credit[oa]do\s+Gs\s*([\d.,]+)/,
    regexSaldo:    /[Ss]aldo\s+([\d.,]+)/,
    regexComercio: /comercio\s+(.+?)(?:\s+Gs|$)/i,
  },
  gnb: {
    remitentes: ['GNB', 'GNBPY'],
    regexDebito:   /[Dd]ébit[o]?\s+([\d.,]+)\s+Gs/,
    regexCredito:  /[Cc]rédit[o]?\s+([\d.,]+)\s+Gs/,
    regexSaldo:    /[Ss]aldo\s+([\d.,]+)/,
    regexComercio: /(.+?)\s+por\s+Gs/i,
  },
  vision: {
    remitentes: ['VISION', 'VISIONBANCO'],
    regexDebito:   /[Ee]greso\s+Gs\s*([\d.,]+)/,
    regexCredito:  /[Ii]ngreso\s+Gs\s*([\d.,]+)/,
    regexSaldo:    /[Ss]aldo\s+([\d.,]+)/,
    regexComercio: /concepto\s+(.+?)(?:\.|$)/i,
  },
  bancop: {
    remitentes: ['BANCOP'],
    regexDebito:   /[Dd]ébit[o]?\s+Gs\.?\s*([\d.,]+)/,
    regexCredito:  /[Cc]rédit[o]?\s+Gs\.?\s*([\d.,]+)/,
    regexSaldo:    /[Ss]aldo\s+([\d.,]+)/,
    regexComercio: /(.+?)\s+Gs/i,
  },
  tigo_money: {
    remitentes: ['TIGO', 'TigoMoney', '8100'],
    regexDebito:   /[Pp]ago\s+de\s+Gs\s*([\d.,]+)/,
    regexCredito:  /[Rr]ecibiste\s+Gs\s*([\d.,]+)/,
    regexSaldo:    /[Ss]aldo\s+actual\s+Gs\s*([\d.,]+)/,
    regexComercio: /a\s+(.+?)(?:\.|$)/,
  },
  // ── A calibrar con SMS reales en Fase 2 ──────────────────────
  sudameris: {
    remitentes: ['SUDAMERIS'],
    regexDebito:   /[Dd]ébit[o]?\s+Gs\.?\s*([\d.,]+)/,
    regexCredito:  /[Cc]rédit[o]?\s+Gs\.?\s*([\d.,]+)/,
    regexSaldo:    /[Ss]aldo\s+([\d.,]+)/,
    regexComercio: null,
  },
  bnf: {
    remitentes: ['BNF', 'BANCONAL'],
    regexDebito:   /[Dd]ébit[o]?\s+Gs\.?\s*([\d.,]+)/,
    regexCredito:  /[Cc]rédit[o]?\s+Gs\.?\s*([\d.,]+)/,
    regexSaldo:    /[Ss]aldo\s+([\d.,]+)/,
    regexComercio: null,
  },
  basa: {
    remitentes: ['BASA'],
    regexDebito:   /[Dd]ébit[o]?\s+Gs\.?\s*([\d.,]+)/,
    regexCredito:  /[Cc]rédit[o]?\s+Gs\.?\s*([\d.,]+)/,
    regexSaldo:    /[Ss]aldo\s+([\d.,]+)/,
    regexComercio: null,
  },
  atlas: {
    remitentes: ['ATLAS'],
    regexDebito:   /[Dd]ébit[o]?\s+Gs\.?\s*([\d.,]+)/,
    regexCredito:  /[Cc]rédit[o]?\s+Gs\.?\s*([\d.,]+)/,
    regexSaldo:    /[Ss]aldo\s+([\d.,]+)/,
    regexComercio: null,
  },
  familiar: {
    remitentes: ['FAMILIAR'],
    regexDebito:   /[Dd]ébit[o]?\s+Gs\.?\s*([\d.,]+)/,
    regexCredito:  /[Cc]rédit[o]?\s+Gs\.?\s*([\d.,]+)/,
    regexSaldo:    /[Ss]aldo\s+([\d.,]+)/,
    regexComercio: null,
  },
  interfisa: {
    remitentes: ['INTERFISA'],
    regexDebito:   /[Dd]ébit[o]?\s+Gs\.?\s*([\d.,]+)/,
    regexCredito:  /[Cc]rédit[o]?\s+Gs\.?\s*([\d.,]+)/,
    regexSaldo:    /[Ss]aldo\s+([\d.,]+)/,
    regexComercio: null,
  },
  solar: {
    remitentes: ['SOLAR'],
    regexDebito:   /[Dd]ébit[o]?\s+Gs\.?\s*([\d.,]+)/,
    regexCredito:  /[Cc]rédit[o]?\s+Gs\.?\s*([\d.,]+)/,
    regexSaldo:    /[Ss]aldo\s+([\d.,]+)/,
    regexComercio: null,
  },
  regional: {
    remitentes: ['REGIONAL'],
    regexDebito:   /[Dd]ébit[o]?\s+Gs\.?\s*([\d.,]+)/,
    regexCredito:  /[Cc]rédit[o]?\s+Gs\.?\s*([\d.,]+)/,
    regexSaldo:    /[Ss]aldo\s+([\d.,]+)/,
    regexComercio: null,
  },
  ueno: {
    remitentes: ['UENO', 'UENOBANK'],
    regexDebito:   /[Pp]ago\s+Gs\s*([\d.,]+)/,
    regexCredito:  /[Rr]ecibido\s+Gs\s*([\d.,]+)/,
    regexSaldo:    /[Ss]aldo\s+([\d.,]+)/,
    regexComercio: null,
  },
  zeta: {
    remitentes: ['ZETA', 'ZETABANCO'],
    regexDebito:   /[Dd]ébit[o]?\s+Gs\.?\s*([\d.,]+)/,
    regexCredito:  /[Cc]rédit[o]?\s+Gs\.?\s*([\d.,]+)/,
    regexSaldo:    /[Ss]aldo\s+([\d.,]+)/,
    regexComercio: null,
  },
  personal_pay: {
    remitentes: ['PERSONAL', 'PERSONALPAY'],
    regexDebito:   /[Pp]ago\s+Gs\s*([\d.,]+)/,
    regexCredito:  /[Rr]ecibiste\s+Gs\s*([\d.,]+)/,
    regexSaldo:    /[Ss]aldo\s+([\d.,]+)/,
    regexComercio: null,
  },
};

/**
 * Detecta qué banco corresponde a un SMS dado su remitente.
 * Retorna el bancoId o null si no se reconoce.
 */
export function detectarBancoPorRemitente(remitente: string): string | null {
  for (const [bancoId, patron] of Object.entries(BANK_SMS_PATTERNS)) {
    if (patron.remitentes.some(r =>
      remitente.toLowerCase().includes(r.toLowerCase())
    )) {
      return bancoId;
    }
  }
  return null;
}

/**
 * Parsea un monto en guaranies desde "1.500.000", "1,500,000" o "1.500,50" y devuelve un entero (redondea decimales)
 */
export function parsearMontoGuarani(raw: string): number {
  const limpio = raw.trim().replace(/[^\d.,]/g, '');
  const commas = (limpio.match(/,/g) || []).length;
  const dots = (limpio.match(/\./g) || []).length;
  if (commas === 1 && /,\d{1,2}$/.test(limpio)) {
    const [ent, dec] = limpio.split(',');
    return Math.round(parseFloat(ent.replace(/\./g, '') + '.' + dec));
  }
  return parseInt(limpio.replace(/[.,]/g, ''), 10);
}
