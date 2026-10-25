/**
 * categorias
 * Responsabilidad: Funciones puras sobre el catalogo de categorias (lista filtrable del Historial y visibilidad de una categoria)
 * Usado por: app/(tabs)/historial.tsx, __tests__/categorias.test.ts
 * Depende de: types/finance.ts (tipo Categoria)
 */
import type { Categoria } from '@/types/finance';

export function categoriasFiltrables(
  categorias: readonly Categoria[],
  ocultas: readonly string[],
): Categoria[] {
  const excluidas = new Set(ocultas);
  return categorias.filter(c => c.tipo !== 'mixto' && !excluidas.has(c.id));
}

export function categoriaVisible(id: string, visibles: readonly Categoria[]): boolean {
  return visibles.some(c => c.id === id);
}
