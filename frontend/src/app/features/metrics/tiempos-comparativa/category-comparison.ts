import { buildStatsView, StatsView } from './stats-view';
import { CategoryResponseTimes } from '../../../api/models/category-response-times';
import { CohortResponseTimes } from '../../../api/models/cohort-response-times';

export interface CategoryComparisonRow {
  category: string;
  automatic: StatsView;
  baseline: StatsView;
  // Tickets de la categoria en cada lado, con o sin tiempo
  automaticTickets: number;
  baselineTickets: number;
  // Cierre de cada lado, indicativo: no hay comparacion fuerte
  automaticClosure: StatsView;
  baselineClosure: StatsView;
}

const MISSING_SIDE: StatsView = { state: 'empty', n: 0, median: null, p90: null, p90Indicative: false };

// Une por nombre exacto de categoria. Una categoria que existe en una sola
// cohorte queda con el otro lado en "empty" (sin tickets). Compara solo la
// primera respuesta, la unica metrica con la misma regla en las dos cohortes.
export function buildCategoryComparison(
  automatic: CohortResponseTimes | undefined,
  baseline: CohortResponseTimes | undefined,
  minSample: number,
): CategoryComparisonRow[] {
  const sideByCategory = (rows: CategoryResponseTimes[]) =>
    new Map(
      rows.map((row) => [
        row.category,
        {
          firstResponse: buildStatsView(row.first_response, minSample),
          closure: buildStatsView(row.closure, minSample),
          tickets: row.tickets,
        },
      ]),
    );

  const automaticSides = sideByCategory(automatic?.by_category ?? []);
  const baselineSides = sideByCategory(baseline?.by_category ?? []);
  const categories = new Set([...automaticSides.keys(), ...baselineSides.keys()]);

  return [...categories]
    .sort((a, b) => a.localeCompare(b, 'es'))
    .map((category) => {
      const automaticSide = automaticSides.get(category);
      const baselineSide = baselineSides.get(category);
      return {
        category,
        automatic: automaticSide?.firstResponse ?? MISSING_SIDE,
        baseline: baselineSide?.firstResponse ?? MISSING_SIDE,
        automaticTickets: automaticSide?.tickets ?? 0,
        baselineTickets: baselineSide?.tickets ?? 0,
        automaticClosure: automaticSide?.closure ?? MISSING_SIDE,
        baselineClosure: baselineSide?.closure ?? MISSING_SIDE,
      };
    });
}

// Para avisar arriba cuando no hay nada contra que comparar.
export function baselineHasTickets(baseline: CohortResponseTimes | undefined): boolean {
  return (baseline?.tickets ?? 0) > 0;
}

export type CategoryComparisonDisplay = 'table' | 'choose-project';

// Con "Todos los proyectos" la comparativa por categoria no tiene sentido:
// cada proyecto tiene sus propias categorias (y en su propio idioma), y el
// backend las trae por separado. Se pide elegir uno. Si no hay proyectos para
// elegir (por ejemplo porque no se pudo cargar la lista), la nota no ayudaria
// y se deja la tabla.
export function categoryComparisonDisplay(projectSelected: boolean, projectsAvailable: boolean): CategoryComparisonDisplay {
  return !projectSelected && projectsAvailable ? 'choose-project' : 'table';
}
