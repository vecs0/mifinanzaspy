/**
 * ocrPrefillRegresion
 * Responsabilidad: regresion de Gemini 3.x que rechaza requests terminados en turno de modelo; el OCR de comprobantes y la importacion por foto envian un solo turno user y parsean la respuesta completa
 * Usado por: jest
 * Depende de: services/ocrService, services/importService, services/apiConfig
 */
import { llamarAIProxy } from '@/services/apiConfig';
import { escanearComprobante } from '@/services/ocrService';
import { parseOCRtoPreview } from '@/services/importService';

jest.mock('@/services/apiConfig', () => ({ llamarAIProxy: jest.fn() }));

const mockProxy = llamarAIProxy as jest.Mock;

function respuestaOK(texto: string) {
  return {
    ok: true,
    status: 200,
    json: jest.fn(async () => ({ candidates: [{ content: { parts: [{ text: texto }] } }] })),
    text: jest.fn(async () => ''),
  };
}

function respuestaError(status: number, detalle = 'Requests ending with a model turn are not supported.') {
  return {
    ok: false,
    status,
    json: jest.fn(async () => ({ error: { message: detalle } })),
    text: jest.fn(async () => detalle),
  };
}

beforeEach(() => {
  mockProxy.mockReset();
});

describe('escanearComprobante', () => {
  it('envia un solo turno user, sin turno model', async () => {
    mockProxy.mockResolvedValueOnce(respuestaOK('{"monto":30000,"descripcion":"Transferencia SPI","fecha":"2026-04-05","tipo":"ingreso","banco":"Mango"}'));

    await escanearComprobante('base64fake', 'image/jpeg');

    const body = mockProxy.mock.calls[0][0];
    expect(body.contents).toHaveLength(1);
    expect(body.contents[0].role).toBe('user');
    expect(body.contents.some((c: any) => c.role === 'model')).toBe(false);
    expect(body.contents[body.contents.length - 1].role).not.toBe('model');
    expect(body.generationConfig.maxOutputTokens).toBe(300);
  });

  it('parsea la respuesta completa sin prefijo concatenado', async () => {
    mockProxy.mockResolvedValueOnce(respuestaOK('{"monto":30000,"descripcion":"Transferencia SPI","fecha":"2026-04-05","tipo":"ingreso","banco":"Mango"}'));

    const r = await escanearComprobante('base64fake');

    expect(r.monto).toBe(30000);
    expect(r.descripcion).toBe('Transferencia SPI');
    expect(r.fecha).toBe('2026-04-05');
    expect(r.tipo).toBe('ingreso');
    expect(r.banco).toBe('Mango');
    expect(r.error).toBeUndefined();
  });

  it('tolera la respuesta envuelta en bloque markdown```json```', async () => {
    mockProxy.mockResolvedValueOnce(respuestaOK('```json\n{"monto":185000,"descripcion":"Farmacia Catedral","fecha":"2026-05-29","tipo":"egreso","banco":"Itaú"}\n```'));

    const r = await escanearComprobante('base64fake');

    expect(r.monto).toBe(185000);
    expect(r.descripcion).toBe('Farmacia Catedral');
    expect(r.banco).toBe('Itaú');
    expect(r.error).toBeUndefined();
  });

  it('devuelve errorCarga ante HTTP 400 sin romper', async () => {
    mockProxy.mockResolvedValueOnce(respuestaError(400));

    const r = await escanearComprobante('base64fake');

    expect(r.errorCarga).toBeDefined();
    expect(r.errorCarga).toBe('archivo_ilegible');
    expect(r.descripcion).toBe('');
  });
});

describe('parseOCRtoPreview', () => {
  it('envia un solo turno user, sin turno model', async () => {
    mockProxy.mockResolvedValueOnce(respuestaOK('[{"monto":-50000,"descripcion":"Supermercado","fecha":"2026-05-29"}]'));

    await parseOCRtoPreview('base64fake', 'image/jpeg');

    const body = mockProxy.mock.calls[0][0];
    expect(body.contents).toHaveLength(1);
    expect(body.contents[0].role).toBe('user');
    expect(body.contents.some((c: any) => c.role === 'model')).toBe(false);
    expect(body.contents[body.contents.length - 1].role).not.toBe('model');
  });

  it('parsea un array JSON completo', async () => {
    mockProxy.mockResolvedValueOnce(respuestaOK('[{"monto":-50000,"descripcion":"Supermercado","fecha":"2026-05-29"}]'));

    const r = await parseOCRtoPreview('base64fake', 'image/jpeg');

    expect(r.error).toBeUndefined();
    expect(r.items).toHaveLength(1);
    expect(r.items[0].monto).toBe(-50000);
    expect(r.items[0].descripcion).toBe('Supermercado');
    expect(r.items[0].fecha).toBe('2026-05-29');
    expect(r.items[0].tipo).toBe('debito');
  });

  it('tolera el array envuelto en bloque markdown```json```', async () => {
    mockProxy.mockResolvedValueOnce(respuestaOK('```json\n[{"monto":120000,"descripcion":"Venta","fecha":"2026-06-01"}]\n```'));

    const r = await parseOCRtoPreview('base64fake', 'image/jpeg');

    expect(r.error).toBeUndefined();
    expect(r.items).toHaveLength(1);
    expect(r.items[0].monto).toBe(120000);
    expect(r.items[0].tipo).toBe('credito');
  });

  it('devuelve errorCarga ante HTTP 400 sin romper', async () => {
    mockProxy.mockResolvedValueOnce(respuestaError(400));

    const r = await parseOCRtoPreview('base64fake', 'image/jpeg');

    expect(r.errorCarga).toBeDefined();
    expect(r.errorCarga).toBe('archivo_ilegible');
    expect(r.items).toHaveLength(0);
  });
});
