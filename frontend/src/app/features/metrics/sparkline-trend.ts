// Tolerancia relativa: si el valor inicial es distinto de cero, una
// variacion menor al 5% del punto de partida se considera "estable". Si el
// punto de partida es cero, se usa la misma magnitud (0.05) como tolerancia
// absoluta, porque ahi una variacion relativa no tiene sentido (division por
// cero).
const STABLE_TOLERANCE = 0.05;

// Texto corto de tendencia para el aria-label del minigrafico: compara el
// primer y el ultimo valor con dato (ignora los huecos, no su posicion).
export function sparklineTrend(values: (number | null)[]): string {
  const known = values.filter((value): value is number => value !== null);
  if (known.length < 2) return 'sin variación suficiente para mostrar tendencia';

  const first = known[0];
  const last = known[known.length - 1];
  const diff = last - first;
  const magnitude = first !== 0 ? Math.abs(diff) / Math.abs(first) : Math.abs(diff);

  if (magnitude < STABLE_TOLERANCE) return 'tendencia estable';
  return diff > 0 ? 'tendencia en alza' : 'tendencia a la baja';
}
