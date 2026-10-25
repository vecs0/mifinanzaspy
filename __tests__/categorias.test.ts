import { CATEGORIAS } from '../constants/categories';
import { categoriasFiltrables, categoriaVisible } from '../services/categorias';

const ids = (cats: { id: string }[]): string[] => cats.map(c => c.id);

describe('categorias', () => {
  it('C1: excluye tipo mixto y conserva el orden del catalogo', () => {
    const visibles = categoriasFiltrables(CATEGORIAS, []);
    expect(visibles.every(c => c.tipo !== 'mixto')).toBe(true);
    expect(ids(visibles)).toEqual([
      'salario',
      'honorarios',
      'venta',
      'intereses',
      'supermercado',
      'restaurante',
      'combustible',
      'transporte',
      'servicios',
      'telefono',
      'farmacia',
      'ropa',
      'hogar',
      'ocio',
      'retiro',
      'deuda',
      'educacion',
      'salud',
    ]);
    expect(ids(visibles)).not.toContain('transferencia');
    expect(ids(visibles)).not.toContain('inversion');
    expect(ids(visibles)).not.toContain('otros');
  });

  it('C1: no muta la entrada y no lanza con arrays vacios', () => {
    const copia = CATEGORIAS.map(c => ({ ...c }));
    expect(categoriasFiltrables(CATEGORIAS, ['salario'])).not.toBe(CATEGORIAS);
    expect(CATEGORIAS).toEqual(copia);
    expect(categoriasFiltrables([], [])).toEqual([]);
    expect(categoriasFiltrables([], ['salario'])).toEqual([]);
  });

  it('C2: aplica la lista de ocultas', () => {
    const visibles = categoriasFiltrables(CATEGORIAS, ['salario', 'ocio', 'transferencia']);
    expect(ids(visibles)).toEqual([
      'honorarios',
      'venta',
      'intereses',
      'supermercado',
      'restaurante',
      'combustible',
      'transporte',
      'servicios',
      'telefono',
      'farmacia',
      'ropa',
      'hogar',
      'retiro',
      'deuda',
      'educacion',
      'salud',
    ]);
  });

  it('C3: todas ocultas devuelve lista vacia sin lanzar', () => {
    const ocultas = CATEGORIAS.map(c => c.id);
    expect(() => categoriasFiltrables(CATEGORIAS, ocultas)).not.toThrow();
    expect(categoriasFiltrables(CATEGORIAS, ocultas)).toEqual([]);
  });

  it('C4: categoriaVisible reconoce la activa oculta y la visible', () => {
    const visibles = categoriasFiltrables(CATEGORIAS, ['ocio']);
    expect(categoriaVisible('ocio', visibles)).toBe(false);
    expect(categoriaVisible('supermercado', visibles)).toBe(true);
    expect(categoriaVisible('transferencia', visibles)).toBe(false);
    expect(categoriaVisible('', visibles)).toBe(false);
    expect(categoriaVisible('ocio', [])).toBe(false);
  });
});
