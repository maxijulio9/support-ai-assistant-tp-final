// Paginado del Historial por casos y tamanos de pagina que se pueden elegir.
export const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;
export const DEFAULT_PAGE_SIZE = 20;

// Un tamano que no es una de las opciones (o no es un numero) se ignora y se usa el de siempre
export function parsePageSize(raw: string | number | null | undefined): number {
  const size = typeof raw === 'number' ? raw : raw === null || raw === undefined || !/^\d+$/.test(raw) ? Number.NaN : Number(raw);
  return (PAGE_SIZE_OPTIONS as readonly number[]).includes(size) ? size : DEFAULT_PAGE_SIZE;
}

export interface HistoryPage<T> {
  items: T[];
  page: number;
  totalPages: number;
  total: number;
  // Posicion de la primera y la ultima fila de la pagina, contando desde 1 (0 si no hay filas)
  from: number;
  to: number;
}

// Una pagina fuera de rango (por ejemplo la de un enlace viejo, o una pagina
// 5 de 20 casos que con 50 por pagina ya no existe) se ignora y vuelve a la primera.
export function paginateCases<T>(rows: readonly T[], requestedPage: number, pageSize: number): HistoryPage<T> {
  const size = parsePageSize(pageSize);
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / size));
  const page = Number.isInteger(requestedPage) && requestedPage >= 1 && requestedPage <= totalPages ? requestedPage : 1;
  const start = (page - 1) * size;
  const items = rows.slice(start, start + size);

  return { items, page, totalPages, total, from: items.length === 0 ? 0 : start + 1, to: start + items.length };
}
