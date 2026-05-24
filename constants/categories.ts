// constants/categories.ts — Categorías predefinidas del motor de clasificación
import type { Categoria } from '@/types/finance';

export const CATEGORIAS: Categoria[] = [
  // ── Ingresos ─────────────────────────────────────────────────
  { id: 'salario',       nombre: 'Salario',            icono: 'arrow-down-left', tinte: '#3F8E5A', tipo: 'ingreso' },
  { id: 'honorarios',    nombre: 'Honorarios',         icono: 'briefcase',       tinte: '#3F8E5A', tipo: 'ingreso' },
  { id: 'venta',         nombre: 'Venta',              icono: 'tag',             tinte: '#3F8E5A', tipo: 'ingreso' },
  { id: 'intereses',     nombre: 'Intereses',          icono: 'trend-up',        tinte: '#3F8E5A', tipo: 'ingreso' },

  // ── Mixtas ────────────────────────────────────────────────────
  { id: 'transferencia', nombre: 'Transferencia',      icono: 'arrows-exchange', tinte: '#6B7280', tipo: 'mixto'  },
  { id: 'inversion',     nombre: 'Inversión',          icono: 'chart',           tinte: '#0F766E', tipo: 'mixto'  },
  { id: 'otros',         nombre: 'Otros',              icono: 'dots',            tinte: '#6B7280', tipo: 'mixto'  },

  // ── Egresos ───────────────────────────────────────────────────
  { id: 'supermercado',  nombre: 'Supermercado',       icono: 'shopping-cart',   tinte: '#B65A1F', tipo: 'egreso' },
  { id: 'restaurante',   nombre: 'Restaurante',        icono: 'cutlery',         tinte: '#C84A4A', tipo: 'egreso' },
  { id: 'combustible',   nombre: 'Combustible',        icono: 'gas',             tinte: '#8B5CF6', tipo: 'egreso' },
  { id: 'transporte',    nombre: 'Transporte',         icono: 'car',             tinte: '#0EA5E9', tipo: 'egreso' },
  { id: 'servicios',     nombre: 'Servicios',          icono: 'bolt',            tinte: '#EAB308', tipo: 'egreso' },
  { id: 'telefono',      nombre: 'Telefonía',          icono: 'phone',           tinte: '#06B6D4', tipo: 'egreso' },
  { id: 'farmacia',      nombre: 'Farmacia',           icono: 'pill',            tinte: '#E11D48', tipo: 'egreso' },
  { id: 'ropa',          nombre: 'Ropa',               icono: 'shirt',           tinte: '#A855F7', tipo: 'egreso' },
  { id: 'hogar',         nombre: 'Hogar',              icono: 'home',            tinte: '#84CC16', tipo: 'egreso' },
  { id: 'ocio',          nombre: 'Ocio',               icono: 'music',           tinte: '#EC4899', tipo: 'egreso' },
  { id: 'retiro',        nombre: 'Retiro efectivo',    icono: 'cash',            tinte: '#6B7280', tipo: 'egreso' },
  { id: 'deuda',         nombre: 'Tarjeta / Préstamo', icono: 'credit-card',     tinte: '#7C2D12', tipo: 'egreso' },
  { id: 'educacion',     nombre: 'Educación',          icono: 'book',            tinte: '#2563EB', tipo: 'egreso' },
  { id: 'salud',         nombre: 'Salud',              icono: 'heart',           tinte: '#E11D48', tipo: 'egreso' },
];

export const CATEGORIA_POR_ID: Record<string, Categoria> =
  Object.fromEntries(CATEGORIAS.map(c => [c.id, c]));

// ─── Palabras clave para clasificación automática ────────────────
// Cada entrada: [palabraClave, categoriaId]
// Se busca (case-insensitive) en la descripción de la transacción.
// El orden importa: primera coincidencia gana.
export const KEYWORDS_CLASIFICACION: [string, string][] = [
  // Ingresos
  ['sueldo',       'salario'],
  ['salario',      'salario'],
  ['haberes',      'salario'],
  ['honorario',    'honorarios'],
  ['factura',      'honorarios'],

  // Servicios paraguayos comunes
  ['ande',         'servicios'],
  ['essap',        'servicios'],
  ['copaco',       'telefono'],
  ['tigo',         'telefono'],
  ['personal',     'telefono'],
  ['claro',        'telefono'],
  ['digicel',      'telefono'],

  // Supermercados / farmacias locales
  ['stock',        'supermercado'],
  ['superseis',    'supermercado'],
  ['biggie',       'supermercado'],
  ['salemma',      'supermercado'],
  ['exito',        'supermercado'],
  ['precio uno',   'supermercado'],
  ['punto farma',  'farmacia'],
  ['farmacia',     'farmacia'],

  // Transporte
  ['muv',          'transporte'],
  ['uber',         'transporte'],
  ['taxi',         'transporte'],
  ['bus',          'transporte'],
  ['petrobras',    'combustible'],
  ['copetrol',     'combustible'],
  ['esso',         'combustible'],
  ['shell',        'combustible'],

  // Ocio / entretenimiento
  ['spotify',      'ocio'],
  ['netflix',      'ocio'],
  ['disney',       'ocio'],
  ['youtube',      'ocio'],
  ['steam',        'ocio'],

  // Transferencias / retiros
  ['retiro',       'retiro'],
  ['cajero',       'retiro'],
  ['atm',          'retiro'],
  ['transferencia','transferencia'],
  ['tx de',        'transferencia'],
  ['a cuenta',     'transferencia'],

  // Deudas
  ['cuota',        'deuda'],
  ['prestamo',     'deuda'],
  ['préstamo',     'deuda'],
  ['tarjeta',      'deuda'],

  // Inversión
  ['inversión',    'inversion'],
  ['plazo fijo',   'inversion'],
  ['dolar',        'inversion'],
  ['dólar',        'inversion'],

  // Restaurantes conocidos en PY
  ['bolsi',        'restaurante'],
  ['mburicao',     'restaurante'],
  ['la table',     'restaurante'],
  ['don vito',     'restaurante'],
  ['mc donalds',   'restaurante'],
  ['burger king',  'restaurante'],
  ['subway',       'restaurante'],
  ['pizza',        'restaurante'],

  // Hogar
  ['casa',         'hogar'],
  ['alquiler',     'hogar'],
  ['renta',        'hogar'],
  ['ferreteria',   'hogar'],
  ['ferretería',   'hogar'],
];
