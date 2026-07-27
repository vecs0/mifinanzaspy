/**
 * traspasoDetector
 * Responsabilidad: Detecta traspasos entre cuentas del usuario
 * Usado por: comprobante
 * Depende de: banks
 */
import { BANKS } from '@/constants/banks';

export interface DeteccionContraparte {
  esTraspaso: boolean;
  contraparteBancoId: string | null;
  contraparteNombre: string | null;
  cuentaParId: string | null;
  confianza: 'alta' | 'media' | 'baja';
}

export interface CuentaResumen {
  id: string;
  bancoId: string;
  alias: string;
}

const PATRONES_BANCO: Record<string, RegExp[]> = {
  itau:         [/ita[uú]/i, /itaú/i],
  continental:  [/continental/i],
  gnb:          [/gnb/i],
  sudameris:    [/sudameris/i],
  bnf:          [/bnf/i, /banco\s*nacional\s*de\s*fomento/i],
  basa:         [/\bbasa\b/i, /banco\s*basa/i],
  atlas:        [/\batlas\b/i, /banco\s*atlas/i],
  familiar:     [/familiar/i, /banco\s*familiar/i],
  bancop:       [/bancop/i],
  interfisa:    [/interfisa/i],
  solar:        [/solar/i, /solar\s*banco/i],
  regional:     [/regional/i, /banco\s*regional/i, /sipap/i],
  ueno:         [/\bueno\b/i, /ueno\s*bank/i],
  zeta:         [/\bzeta\b/i, /zeta\s*banco/i],
  citi:         [/\bciti\b/i, /citibank/i],
  bna:          [/\bbna\b/i, /banco\s*naci[oó]n/i],
  bbrasil:      [/banco\s*do\s*brasil/i, /\bbb\b/i],
  tigo_money:   [/tigo\s*money/i, /\btigo\b/i],
  personal_pay: [/personal\s*pay/i, /\bpersonal\b/i],
  pago_express: [/pago\s*express/i, /pagoexpress/i],
  mango:        [/\bmango\b/i],
};

const FRASES_TRASPASO_PROPIO = [
  /transferencia\s+(a|hacia)\s+mi\s+cuenta/i,
  /traspaso\s+(a|hacia)\s+mi\s+cuenta/i,
  /transferencia\s+propia/i,
  /traspaso\s+propio/i,
  /cuenta\s+propia/i,
  /mis\s+cuentas/i,
  /transfer[eê]ncia\s+entre\s+contas/i,
  /traspaso\s+de\s+fondos/i,
  /env[ií]o\s+a\s+mi\s+cuenta/i,
];

export function detectarContraparte(
  descripcion: string,
  cuentas: CuentaResumen[],
  bancoIdExtracto: string,
): DeteccionContraparte {
  const desc = descripcion.trim();

  const contraparteBancoId = detectarBancoEnDescripcion(desc, bancoIdExtracto);
  const contraparteNombre = extraerNombreContraparte(desc);
  const esTraspaso = determinarSiEsTraspaso(desc, contraparteBancoId, cuentas, bancoIdExtracto);

  let cuentaParId: string | null = null;
  let confianza: DeteccionContraparte['confianza'] = 'baja';

  if (esTraspaso && contraparteBancoId) {
    const cuentaPar = cuentas.find(c => c.bancoId === contraparteBancoId);
    if (cuentaPar) {
      cuentaParId = cuentaPar.id;
      confianza = 'alta';
    } else {
      confianza = 'media';
    }
  } else if (contraparteBancoId) {
    confianza = 'media';
  }

  return {
    esTraspaso,
    contraparteBancoId,
    contraparteNombre,
    cuentaParId,
    confianza,
  };
}

function detectarBancoEnDescripcion(
  desc: string,
  bancoIdExtracto: string,
): string | null {
  for (const [bancoId, patrones] of Object.entries(PATRONES_BANCO)) {
    if (bancoId === bancoIdExtracto) continue;
    for (const patron of patrones) {
      if (patron.test(desc)) return bancoId;
    }
  }
  return null;
}

function extraerNombreContraparte(desc: string): string | null {
  const patrones = [
    /transferencia\s+(?:enviada\s+)?a\s+(.+?)(?:\s*[-–,]|$)/i,
    /transferencia\s+(?:recibida\s+)?de\s+(.+?)(?:\s*[-–,]|$)/i,
    /pago\s+a\s+(.+?)(?:\s*[-–,]|$)/i,
    /recibido\s+de\s+(.+?)(?:\s*[-–,]|$)/i,
    /cobro\s+de\s+(.+?)(?:\s*[-–,]|$)/i,
    /traspaso\s+(?:a|de)\s+(.+?)(?:\s*[-–,]|$)/i,
    /env[ií]o\s+a\s+(.+?)(?:\s*[-–,]|$)/i,
  ];

  for (const patron of patrones) {
    const match = desc.match(patron);
    if (match?.[1]) {
      const nombre = match[1].trim();
      const esBanco = BANKS.some(b =>
        b.corto.toLowerCase() === nombre.toLowerCase() ||
        b.nombre.toLowerCase() === nombre.toLowerCase()
      );
      if (!esBanco && nombre.length > 2 && nombre.length < 80) return nombre;
    }
  }
  return null;
}

function determinarSiEsTraspaso(
  desc: string,
  contraparteBancoId: string | null,
  cuentas: CuentaResumen[],
  bancoIdExtracto: string,
): boolean {
  for (const frase of FRASES_TRASPASO_PROPIO) {
    if (frase.test(desc)) return true;
  }

  if (contraparteBancoId) {
    const usuarioTieneEsaCuenta = cuentas.some(c =>
      c.bancoId === contraparteBancoId && c.bancoId !== bancoIdExtracto
    );
    if (usuarioTieneEsaCuenta) {
      const nombreTercero = extraerNombreContraparte(desc);
      if (!nombreTercero) return true;
    }
  }

  return false;
}

export interface MovimientoParaProcesar {
  id: string;
  descripcion: string;
  tipo: 'credito' | 'debito';
  bancoId: string;
  cuentaId: string;
}

export interface ResultadoDeteccion {
  transaccionId: string;
  esTraspaso: number;
  cuentaParId: string | null;
  contraparteBancoId: string | null;
  contraparteNombre: string | null;
  confianza: string;
}

export function procesarLoteMovimientos(
  movimientos: MovimientoParaProcesar[],
  cuentas: CuentaResumen[],
): ResultadoDeteccion[] {
  return movimientos.map(mov => {
    const deteccion = detectarContraparte(mov.descripcion, cuentas, mov.bancoId);
    return {
      transaccionId: mov.id,
      esTraspaso: deteccion.esTraspaso ? 1 : 0,
      cuentaParId: deteccion.cuentaParId,
      contraparteBancoId: deteccion.contraparteBancoId,
      contraparteNombre: deteccion.contraparteNombre,
      confianza: deteccion.confianza,
    };
  });
}
