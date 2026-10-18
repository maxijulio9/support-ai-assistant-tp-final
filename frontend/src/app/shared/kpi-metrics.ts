// Tasa sobre un total: null si el total es 0 (no hay division por cero).
export function rate(count: number, total: number): number | null {
  return total > 0 ? count / total : null;
}

// Delta en puntos porcentuales: diferencia entre dos tasas (0-1), expresada
// en puntos (x100). null si falta cualquiera de los dos lados.
export function ppDelta(current: number | null, previous: number | null): number | null {
  return current !== null && previous !== null ? (current - previous) * 100 : null;
}

// Delta como diferencia cruda entre dos valores en la misma escala (no una
// tasa sobre un total). null si falta cualquiera de los dos lados.
export function rawDelta(current: number | null, previous: number | null): number | null {
  return current !== null && previous !== null ? current - previous : null;
}

// Delta como crecimiento relativo (%): para conteos totales, no tasas. null
// si falta cualquiera de los dos lados o si el anterior es 0 (division por
// cero).
export function percentGrowth(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}
