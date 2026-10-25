import {
  MENSAJES_CARGA,
  SIN_MOVIMIENTOS,
  clasificarExcepcion,
  clasificarHTTP,
  mensajeDeCarga,
} from '../services/erroresIA';
import type { CasoErrorCarga } from '../services/erroresIA';

const TEXTOS: Record<CasoErrorCarga, string> = {
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

const CASOS = Object.keys(TEXTOS) as CasoErrorCarga[];

function errorConNombre(name: string, message = 'falló'): Error {
  const e = new Error(message);
  e.name = name;
  return e;
}

describe('los siete mensajes de carga', () => {
  it('define exactamente los siete casos de RF-A9', () => {
    expect(CASOS).toHaveLength(7);
    expect(Object.keys(MENSAJES_CARGA).sort()).toEqual([...CASOS].sort());
  });

  it.each(CASOS)('%s devuelve su texto exacto', (caso) => {
    expect(MENSAJES_CARGA[caso]).toBe(TEXTOS[caso]);
    expect(mensajeDeCarga(caso)).toBe(TEXTOS[caso]);
  });

  it('ningún mensaje muestra cuerpo crudo, URL, token, estado HTTP ni jerga técnica', () => {
    const prohibidos = [
      'Error API',
      'Respuesta cruda',
      'http',
      'https',
      '://',
      'token',
      'Worker',
      'status',
      'undefined',
      'null',
    ];

    for (const caso of CASOS) {
      const mensaje = mensajeDeCarga(caso);
      expect(mensaje.length).toBeGreaterThan(0);
      expect(mensaje).not.toMatch(/\b[1-5]\d\d\b/);
      for (const prohibido of prohibidos) {
        expect(mensaje.toLowerCase()).not.toContain(prohibido.toLowerCase());
      }
    }
  });
});

describe('clasificarHTTP', () => {
  it('413 es archivo demasiado grande', () => {
    expect(clasificarHTTP(413)).toBe('archivo_grande');
  });

  it('401 y 403 son problema de configuración del servicio', () => {
    expect(clasificarHTTP(401)).toBe('credencial_no_configurada');
    expect(clasificarHTTP(403)).toBe('credencial_no_configurada');
  });

  it('429 es límite de consultas', () => {
    expect(clasificarHTTP(429)).toBe('limite_consultas');
  });

  it('500 y superiores son servicio no disponible', () => {
    expect(clasificarHTTP(500)).toBe('servicio_no_disponible');
    expect(clasificarHTTP(502)).toBe('servicio_no_disponible');
    expect(clasificarHTTP(503)).toBe('servicio_no_disponible');
  });

  it('500 con "no configurado" en el cuerpo es credencial no configurada', () => {
    expect(clasificarHTTP(500, '{"error":"Worker no configurado"}')).toBe(
      'credencial_no_configurada',
    );
    expect(clasificarHTTP(500, 'NO CONFIGURADO')).toBe('credencial_no_configurada');
  });

  it('otros estados se tratan como archivo ilegible', () => {
    expect(clasificarHTTP(400)).toBe('archivo_ilegible');
    expect(clasificarHTTP(404)).toBe('archivo_ilegible');
  });
});

describe('clasificarExcepcion', () => {
  it('AbortError es servicio no disponible (tiempo agotado)', () => {
    expect(clasificarExcepcion(errorConNombre('AbortError'))).toBe('servicio_no_disponible');
  });

  it('TypeError de red es sin conexión', () => {
    expect(clasificarExcepcion(new TypeError('Network request failed'))).toBe('sin_conexion');
  });

  it('WorkerNoConfiguradoError es credencial no configurada', () => {
    expect(clasificarExcepcion(errorConNombre('WorkerNoConfiguradoError'))).toBe(
      'credencial_no_configurada',
    );
  });

  it('una excepción desconocida cae en archivo ilegible', () => {
    expect(clasificarExcepcion(errorConNombre('Error'))).toBe('archivo_ilegible');
    expect(clasificarExcepcion(undefined)).toBe('archivo_ilegible');
  });
});

describe('sin movimientos es informativo, no error', () => {
  it('no aparece entre los mensajes de error', () => {
    const valores = Object.values(MENSAJES_CARGA);
    expect(valores).not.toContain(SIN_MOVIMIENTOS);
  });

  it('no es un caso de error válido', () => {
    expect(CASOS).not.toContain(SIN_MOVIMIENTOS);
    expect((MENSAJES_CARGA as Record<string, string>)[SIN_MOVIMIENTOS]).toBeUndefined();
  });

  it('tiene el texto de vuelta al selector', () => {
    expect(SIN_MOVIMIENTOS).toBe('No encontramos movimientos en este archivo');
  });
});
