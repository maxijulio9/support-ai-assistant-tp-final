import { buildStatsView, StatsView } from './stats-view';
import { CategoryRowLike, CohortLike } from './response-times.types';

export interface CategoryComparisonRow {
  category: string;
  automatic: StatsView;
  baseline: StatsView;
}

const MISSING_SIDE: StatsView = { state: 'empty', n: 0, median: null, p90: null, p90Indicative: false };

// Une por nombre exacto de categoria. Una categoria que existe en una sola
// cohorte queda con el otro lado en "empty" (sin tickets). Compara solo la
// primera respuesta, la unica metrica con la misma regla en las dos cohortes.
export function buildCategoryComparison(
  automatic: CohortLike | undefined,
  baseline: CohortLike | undefined,
  minSample: number,
): CategoryComparisonRow[] {
  const sideByCategory = (rows: CategoryRowLike[]) =>
    new Map(rows.map((row) => [row.category, buildStatsView(row.first_response, minSample)]));

  const automaticSides = sideByCategory(automatic?.by_category ?? []);
  const baselineSides = sideByCategory(baseline?.by_category ?? []);
  const categories = new Set([...automaticSides.keys(), ...baselineSides.keys()]);

  return [...categories]
    .sort((a, b) => a.localeCompare(b, 'es'))
    .map((category) => ({
      category,
      automatic: automaticSides.get(category) ?? MISSING_SIDE,
      baseline: baselineSides.get(category) ?? MISSING_SIDE,
    }));
}

// Para avisar arriba cuando no hay nada contra que comparar.
export function baselineHasTickets(baseline: CohortLike | undefined): boolean {
  return (baseline?.tickets ?? 0) > 0;
}
