// Paginado de la lista de categorias. Es una funcion pura: la pagina pedida
// se recorta al rango valido, asi un cambio de filtros que deja menos
// categorias no deja la lista en una pagina vacia.
export interface CategoryPage<T> {
  items: T[];
  page: number;
  totalPages: number;
  total: number;
  // Posicion de la primera y la ultima fila de la pagina, contando desde 1 (0 si no hay filas)
  from: number;
  to: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

export function paginate<T>(rows: readonly T[], requestedPage: number, pageSize: number): CategoryPage<T> {
  const size = Math.max(1, Math.floor(pageSize));
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / size));
  const requested = Number.isFinite(requestedPage) ? Math.floor(requestedPage) : 1;
  const page = Math.min(Math.max(requested, 1), totalPages);
  const start = (page - 1) * size;
  const items = rows.slice(start, start + size);

  return {
    items,
    page,
    totalPages,
    total,
    from: items.length === 0 ? 0 : start + 1,
    to: start + items.length,
    hasPrevious: page > 1,
    hasNext: page < totalPages,
  };
}

// Texto del rango, el mismo formato que el paginador de Historial
export function pageRangeText(page: CategoryPage<unknown>): string {
  return `${page.from}-${page.to} de ${page.total} ${page.total === 1 ? 'categoría' : 'categorías'}`;
}
