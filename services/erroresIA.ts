/**
 * erroresIA
 * Responsabilidad: Los siete casos de error de carga de datos con IA y sus mensajes de usuario; clasificacion por estado HTTP y por excepcion; mensaje informativo de sin movimientos
 * Usado por: services/importService.ts, services/batchImportService.ts, services/ocrService.ts, app/comprobante.tsx
 * Depende de: ninguno
 */
export type CasoErrorCarga =
  | 'pdf_protegido'
  | 'archivo_ilegible'
  | 'archivo_grande'
  | 'sin_conexion'
  | 'servicio_no_disponible'
  | 'limite_consultas'
  | 'credencial_no_configurada';

export const MENSAJES_CARGA: Record<CasoErrorCarga, string> = {
  pdf_protegido:
    'No pudimos abrir el PDF. Si tiene contraseña, quitásela y volvé a intentar.',
  archivo_ilegible:
    'No pudimos leer este archivo. Probá con una foto más nítida o con el PDF original.',
  archivo_grande:
    'El archivo es muy grande para analizarlo de una vez. Dividilo en partes más chicas y volvé a intentar.',
  sin_conexion:
    'Parece que no hay conexión a internet. Revisá tu conexión y volvé a intentar.',
  servicio_no_disponible:
    'El servicio de análisis no está disponible o tardó demasiado. Probá de nuevo en un rato.',
  limite_consultas:
    'Llegaste al límite de análisis por minuto. Esperá un momento y volvé a intentar.',
  credencial_no_configurada:
    'El análisis con IA no está configurado en esta instalación. Pedile a quien instaló la app que complete la configuración.',
};

export const SIN_MOVIMIENTOS = 'No encontramos movimientos en este archivo';

export function clasificarHTTP(status: number, detalle?: string): CasoErrorCarga {
  if (status === 401 || status === 403) return 'credencial_no_configurada';
  if (status === 413) return 'archivo_grande';
  if (status === 429) return 'limite_consultas';
  if (status >= 500) {
    if (detalle && detalle.toLowerCase().includes('no configurado')) {
      return 'credencial_no_configurada';
    }
    return 'servicio_no_disponible';
  }
  return 'archivo_ilegible';
}

export function clasificarExcepcion(error: unknown): CasoErrorCarga {
  const nombre = (error as { name?: string } | null | undefined)?.name;
  if (nombre === 'AbortError') return 'servicio_no_disponible';
  if (nombre === 'WorkerNoConfiguradoError') return 'credencial_no_configurada';
  if (error instanceof TypeError) return 'sin_conexion';
  return 'archivo_ilegible';
}

export function mensajeDeCarga(caso: CasoErrorCarga): string {
  return MENSAJES_CARGA[caso];
}
