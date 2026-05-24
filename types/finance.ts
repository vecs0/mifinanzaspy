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

export interface ProyeccionMes {
  diasRestantes:     number;
  gastoProyectado:   number;
  ingresoEstimado:   number;
  saldoProyectado:   number;
  pctIngresoGastado: number;
  estadoSalud:       EstadoSalud;
}

// ─── Estado del onboarding ───────────────────────────────────────

export interface EstadoOnboarding {
  completado:        boolean;
  fechaCompletado:   string | null;
  bancosSeleccionados: string[];  // IDs de bancos
  permisoSMS:        boolean;
  permisoNotif:      boolean;
}

// ─── Contexto financiero para el chatbot IA ─────────────────────

export interface ContextoFinancieroIA {
  fechaConsulta:      string;
  saldoTotal:         number;
  cuentas:            { alias: string; banco: string; saldo: number; moneda: Moneda }[];
  resumenMes:         ResumenMensual;
  proyeccion:         ProyeccionMes;
  ultimasTransacciones: Pick<Transaccion, 'descripcion' | 'monto' | 'categoriaId' | 'fecha' | 'bancoId'>[];
  topGastosCategoria: { categoriaId: string; nombre: string; total: number }[];
}

// ─── Datos de barras para el gráfico semanal ────────────────────

export interface DatoBarra {
  fecha: string;   // "2026-05-23"
  dia:   string;   // "Vie"
  total: number;   // Total egresos del día (positivo)
}

// ─── Store global (Zustand) ──────────────────────────────────────

export interface AppStore {
  // Estado
  onboarding:    EstadoOnboarding;
  cuentas:       CuentaBancaria[];
  transacciones: Transaccion[];
  categorias:    Categoria[];
  proyeccion:    ProyeccionMes | null;
  cargando:      boolean;
  error:         string | null;

  // Acciones
  cargarDatos:          () => Promise<void>;
  agregarTransaccion:   (tx: Omit<Transaccion, 'id'>) => Promise<void>;
  actualizarSaldo:      (cuentaId: string, saldo: number) => Promise<void>;
  completarOnboarding:  (datos: Partial<EstadoOnboarding>) => Promise<void>;
  calcularProyeccion:   () => ProyeccionMes;
}
