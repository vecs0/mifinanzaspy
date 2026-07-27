// types/finance.ts — Tipos TypeScript del dominio financiero paraguayo
// Todos los montos en Guaraníes (PYG), sin decimales.

// ─── Enums y uniones ────────────────────────────────────────────

export type Moneda = 'PYG' | 'USD';

export type TipoCuenta = 'corriente' | 'ahorro' | 'billetera' | 'credito';

export type TipoTransaccion = 'debito' | 'credito' | 'transferencia';

export type FuenteCaptura = 'sms' | 'notificacion' | 'manual' | 'csv' | 'email';

export type TipoIngreso = 'ingreso' | 'egreso' | 'mixto';

export type EstadoSalud = 'estable' | 'atencion' | 'riesgo';

export type GrupoBanco = 'tradicional' | 'digital' | 'billetera' | 'manual';

export type TipoReporte = 'diario' | 'semanal' | 'mensual';

// ─── Banco del catálogo paraguayo ───────────────────────────────

export interface BancoInfo {
  id:         string;      // "itau", "continental", etc.
  nombre:     string;      // "Banco Itaú Paraguay"
  corto:      string;      // "Itaú" — para tarjetas y chips
  grupo:      GrupoBanco;
  monograma:  string;      // Letra para avatar fallback
  tinte:      string;      // Color hex de la marca
  appPackage: string;      // Android package ID para NotificationListener
  remitentes: string[];    // Remitentes SMS conocidos
}

// ─── Cuenta bancaria del usuario ────────────────────────────────

export interface CuentaBancaria {
  id:              string;      // UUID único
  bancoId:         string;      // FK → BancoInfo.id
  bancoNombre:     string;      // Nombre display
  appPackage:      string;      // Package ID para NotificationListener
  tipoCuenta:      TipoCuenta;
  alias:           string;      // "Mi cuenta Itaú"
  saldoActual:     number;      // En Guaraníes, sin decimales (USD × tasa para USD)
  saldoActualUSD?: number;      // Solo si moneda === 'USD'
  moneda:          Moneda;
  activa:          boolean;
  smsHabilitado:   boolean;
  notifHabilitada: boolean;
  color:           string;      // Color hex de identificación visual
  icono:           string;      // Nombre del ícono
  orden:           number;      // Posición de ordenamiento (0 = primero)
  fechaCreacion:   string;      // ISO date
}

// ─── Categoría de transacción ────────────────────────────────────

export interface Categoria {
  id:     string;        // "supermercado", "salario", etc.
  nombre: string;        // "Supermercado"
  icono:  string;        // Nombre del ícono
  tinte:  string;        // Color hex
  tipo:   TipoIngreso;
}

// ─── Transacción financiera ──────────────────────────────────────

export interface Transaccion {
  id:            string;      // UUID único
  cuentaId:      string;      // FK → CuentaBancaria.id
  bancoId:       string;      // Desnormalizado para filtros rápidos
  monto:         number;      // Positivo = ingreso, negativo = egreso (en PYG)
  tipo:          TipoTransaccion;
  categoriaId:   string;      // FK → Categoria.id
  descripcion:   string;      // "Stock Avda. España", "ANDE electricidad"
  fuente:        FuenteCaptura;
  fecha:         string;      // ISO datetime
  saldoPost:     number | null; // Saldo resultante si lo trae el SMS
  smsRaw:        string | null; // Texto original del SMS (para auditoría)
  procesado:     boolean;     // Si ya fue clasificado y confirmado
  notas:         string | null; // Nota libre del usuario
  adjunto:       string | null; // URI de imagen/PDF adjunto
  esTraspaso?:   number;      // 1 si es traspaso entre cuentas propias
  cuentaParId?:  string | null; // FK → CuentaBancaria.id (la otra cuenta)
  contraparteBancoId?: string | null; // banco_id detectado por Gemini
  contraparteNombre?: string | null;  // Nombre de persona/empresa en descripción
}

// ─── Regla de clasificación automática ──────────────────────────

export interface ReglaClasificacion {
  id:          string;
  patronTexto: string;   // Substring o regex a buscar en descripción
  categoriaId: string;
  prioridad:   number;   // Mayor número = mayor prioridad
  esRegex:     boolean;
}

// ─── Patrón SMS por banco ────────────────────────────────────────

export interface PatronSMSBanco {
  remitentes:     string[];
  regexDebito:    RegExp;
  regexCredito:   RegExp;
  regexSaldo:     RegExp | null;
  regexComercio:  RegExp | null;
}

// ─── Reporte (caché en DB) ───────────────────────────────────────

export interface ReporteCache {
  id:           string;
  tipo:         TipoReporte;
  fecha:        string;        // "2026-05-23"
  contenidoJson: string;       // JSON serializado del resumen
}

// ─── Resúmenes calculados ────────────────────────────────────────

export interface ResumenDiario {
  fecha:          string;
  totalIngresos:  number;
  totalEgresos:   number;
  saldoNeto:      number;
  categoriaTopId: string;
  promedioMes:    number;      // Promedio diario del mes hasta hoy
}

export interface ResumenMensual {
  mes:              string;    // "2026-05"
  totalIngresos:    number;
  totalEgresos:     number;
  saldoNeto:        number;
  topCategorias:    { categoriaId: string; total: number }[];
  comparacionMes:   number;   // Diferencia vs mes anterior (%)
}

// ─── Estado del onboarding ───────────────────────────────────────

export interface NotificacionApp {
  id: string;
  titulo: string;
  cuerpo: string;
  tipo: 'bienvenida' | 'alerta' | 'info' | 'reporte';
  leida: boolean;
  eliminada: boolean;
  fechaCreacion: string;
}

export interface EstadoOnboarding {
  completado:        boolean;
  fechaCompletado:   string | null;
  bancosSeleccionados: string[];  // IDs de bancos
  permisoSMS:        boolean;
  permisoNotif:      boolean;
}


