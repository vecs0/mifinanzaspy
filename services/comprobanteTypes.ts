/**
 * comprobanteTypes
 * Responsabilidad: Tipos compartidos para flujo de comprobante
 * Usado por: comprobante, SuccessScreen, ResultsScreen, EditScreen, VerificationScreen
 * Depende de: (ninguna, solo tipos)
 */
export type TipoMov = 'ingreso' | 'egreso';

export interface MovimientoDetectado {
  _tempId: string;
  tipo: TipoMov;
  descripcion: string;
  monto: number;
  fecha: string;
  hora: string;
  mes: string;
  banco?: string;
  fechaAsumida?: boolean;
  hash?: string;
  adjunto?: string;
}
