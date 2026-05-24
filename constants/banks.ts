// constants/banks.ts — Catálogo completo de bancos y billeteras paraguayas
import type { BancoInfo } from '@/types/finance';

export const BANKS: BancoInfo[] = [
  // ── Bancos tradicionales ──────────────────────────────────────
  {
    id: 'itau',
    nombre: 'Banco Itaú Paraguay',
    corto: 'Itaú',
    grupo: 'tradicional',
    monograma: 'I',
    tinte: '#E97B26',
    appPackage: 'py.com.itau.nmb.android',
    remitentes: ['ITAU', 'Itaú', '37828'],
  },
  {
    id: 'continental',
    nombre: 'Banco Continental',
    corto: 'Continental',
    grupo: 'tradicional',
    monograma: 'C',
    tinte: '#0B6CB2',
    appPackage: 'py.com.continental.mobile',
    remitentes: ['CONTINENTAL', '60056'],
  },
  {
    id: 'gnb',
    nombre: 'GNB Paraguay',
    corto: 'GNB',
    grupo: 'tradicional',
    monograma: 'G',
    tinte: '#7A2330',
    appPackage: 'py.com.gnb.app',
    remitentes: ['GNB', 'GNBPY'],
  },
  {
    id: 'sudameris',
    nombre: 'Sudameris Bank',
    corto: 'Sudameris',
    grupo: 'tradicional',
    monograma: 'S',
    tinte: '#1F3A8A',
    appPackage: 'py.com.sudameris.app',
    remitentes: ['SUDAMERIS', 'SUDAMERISBANK'],
  },
  {
    id: 'bnf',
    nombre: 'Banco Nacional de Fomento',
    corto: 'BNF',
    grupo: 'tradicional',
    monograma: 'B',
    tinte: '#0F6B3A',
    appPackage: 'py.com.bnf.mobile',
    remitentes: ['BNF', 'BANCONAL'],
  },
  {
    id: 'basa',
    nombre: 'Banco Basa',
    corto: 'Basa',
    grupo: 'tradicional',
    monograma: 'B',
    tinte: '#2A3142',
    appPackage: 'py.com.basa.app',
    remitentes: ['BASA', 'BANCOBASA'],
  },
  {
    id: 'atlas',
    nombre: 'Banco Atlas',
    corto: 'Atlas',
    grupo: 'tradicional',
    monograma: 'A',
    tinte: '#C92B2B',
    appPackage: 'py.com.atlas.app',
    remitentes: ['ATLAS', 'BANCOATLAS'],
  },
  {
    id: 'familiar',
    nombre: 'Banco Familiar',
    corto: 'Familiar',
    grupo: 'tradicional',
    monograma: 'F',
    tinte: '#1B5BA5',
    appPackage: 'py.com.familiar.app',
    remitentes: ['FAMILIAR', 'BANCOFAMILIAR'],
  },
  {
    id: 'bancop',
    nombre: 'BANCOP',
    corto: 'Bancop',
    grupo: 'tradicional',
    monograma: 'B',
    tinte: '#0E7A4F',
    appPackage: 'py.com.bancop.app',
    remitentes: ['BANCOP'],
  },
  {
    id: 'interfisa',
    nombre: 'Interfisa Banco',
    corto: 'Interfisa',
    grupo: 'tradicional',
    monograma: 'I',
    tinte: '#4A2C7A',
    appPackage: 'py.com.interfisa.app',
    remitentes: ['INTERFISA'],
  },
  {
    id: 'solar',
    nombre: 'Solar Banco',
    corto: 'Solar',
    grupo: 'tradicional',
    monograma: 'S',
    tinte: '#D97706',
    appPackage: 'py.com.solar.app',
    remitentes: ['SOLAR', 'SOLARBANCO'],
  },
  {
    id: 'regional',
    nombre: 'Banco Regional',
    corto: 'Regional',
    grupo: 'tradicional',
    monograma: 'R',
    tinte: '#0F4C81',
    appPackage: 'py.com.regional.app',
    remitentes: ['REGIONAL', 'BANCOREGIONAL'],
  },
  {
    id: 'vision',
    nombre: 'Visión Banco',
    corto: 'Visión',
    grupo: 'tradicional',
    monograma: 'V',
    tinte: '#1A8754',
    appPackage: 'py.com.vision.app',
    remitentes: ['VISION', 'VISIONBANCO'],
  },
  // ── Bancos digitales y extranjeros ────────────────────────────
  {
    id: 'ueno',
    nombre: 'Ueno Bank',
    corto: 'Ueno',
    grupo: 'digital',
    monograma: 'u',
    tinte: '#10B981',
    appPackage: 'py.com.ueno.app',
    remitentes: ['UENO', 'UENOBANK'],
  },
  {
    id: 'zeta',
    nombre: 'ZETA Banco',
    corto: 'ZETA',
    grupo: 'digital',
    monograma: 'Z',
    tinte: '#1A1A1A',
    appPackage: 'py.com.zeta.app',
    remitentes: ['ZETA', 'ZETABANCO'],
  },
  {
    id: 'citi',
    nombre: 'Citibank N.A.',
    corto: 'Citi',
    grupo: 'digital',
    monograma: 'c',
    tinte: '#0552A0',
    appPackage: 'com.citi.mobile',
    remitentes: ['CITI', 'CITIBANK'],
  },
  {
    id: 'bna',
    nombre: 'Banco Nación Argentina',
    corto: 'BNA',
    grupo: 'digital',
    monograma: 'N',
    tinte: '#5BA3D0',
    appPackage: 'ar.gob.bna.bnaplus',
    remitentes: ['BNA', 'BNAPLUS'],
  },
  {
    id: 'bbrasil',
    nombre: 'Banco do Brasil',
    corto: 'BB',
    grupo: 'digital',
    monograma: 'B',
    tinte: '#C8A200',
    appPackage: 'br.com.bb.android',
    remitentes: ['BB', 'BANCODOBRASIL'],
  },
  // ── Billeteras digitales ───────────────────────────────────────
  {
    id: 'tigo_money',
    nombre: 'Tigo Money',
    corto: 'Tigo Money',
    grupo: 'billetera',
    monograma: 't',
    tinte: '#0C4DA2',
    appPackage: 'com.juvo.tigomoney',
    remitentes: ['TIGO', 'TigoMoney', '8100'],
  },
  {
    id: 'personal_pay',
    nombre: 'Personal Pay',
    corto: 'Personal',
    grupo: 'billetera',
    monograma: 'P',
    tinte: '#7C3AED',
    appPackage: 'py.com.personal.pay',
    remitentes: ['PERSONAL', 'PERSONALPAY'],
  },
  {
    id: 'pago_express',
    nombre: 'Pago Express',
    corto: 'Pago Exp.',
    grupo: 'billetera',
    monograma: 'E',
    tinte: '#DC2626',
    appPackage: 'py.com.pagoexpress',
    remitentes: ['PAGOEXPRESS', 'PAGO_EXPRESS'],
  },
];

export const BANCO_POR_ID: Record<string, BancoInfo> =
  Object.fromEntries(BANKS.map(b => [b.id, b]));

export const BANCOS_TRADICIONALES = BANKS.filter(b => b.grupo === 'tradicional');
export const BANCOS_DIGITALES     = BANKS.filter(b => b.grupo === 'digital');
export const BILLETERAS           = BANKS.filter(b => b.grupo === 'billetera');

/** Colores predeterminados para cuentas nuevas (rotación circular) */
export const COLORES_CUENTA = [
  '#B36A2A', '#3F8E5A', '#1B5BA5', '#7C3AED',
  '#C92B2B', '#0F6B3A', '#E97B26', '#0552A0',
];

/** Devuelve el package ID de todos los bancos activos — para NotificationListener */
export function getPackagesActivos(bancoIds: string[]): string[] {
  return bancoIds
    .map(id => BANCO_POR_ID[id]?.appPackage)
    .filter(Boolean) as string[];
}
