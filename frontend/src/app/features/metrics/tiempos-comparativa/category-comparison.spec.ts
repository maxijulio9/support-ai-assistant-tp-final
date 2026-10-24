import { baselineHasTickets, buildCategoryComparison } from './category-comparison';
import { CohortResponseTimes } from '../../../api/models/cohort-response-times';
import { TimeStats } from '../../../api/models/time-stats';

function stats(count: number, p50: number | null = null, p90: number | null = null): TimeStats {
  return { count, mean_seconds: p50, p50_seconds: p50, p90_seconds: p90, within_target_rate: null };
}

function cohort(key: string, categories: Record<string, TimeStats>, tickets = 0): CohortResponseTimes {
  return {
    cohort: key,
    first_response_kind: 'answer',
    closure_basis: 'detected_confirmation',
    tickets,
    first_response: stats(tickets),
    closure: stats(0),
    outcomes: [],
    by_category: Object.entries(categories).map(([category, firstResponse]) => ({
      category,
      tickets: firstResponse.count,
      first_response: firstResponse,
      closure: stats(0),
    })),
    daily: [],
    weekly: [],
  };
}

describe('buildCategoryComparison', () => {
  it('une por nombre de categoria con p50 y p90 de cada lado', () => {
    const rows = buildCategoryComparison(
      cohort('automatic', { Facturacion: stats(12, 20, 60) }),
      cohort('baseline', { Facturacion: stats(30, 3600, 7200) }),
      5,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].category).toBe('Facturacion');
    expect(rows[0].automatic).toMatchObject({ state: 'ok', n: 12, median: '20 s', p90: '1 min' });
    expect(rows[0].baseline).toMatchObject({ state: 'ok', n: 30, median: '1 h', p90: '2 h' });
  });

  it('una categoria solo en la automatica deja el baseline sin tickets', () => {
    const [row] = buildCategoryComparison(cohort('automatic', { Acceso: stats(8, 15, 40) }), cohort('baseline', {}), 5);

    expect(row.automatic.state).toBe('ok');
    expect(row.baseline).toMatchObject({ state: 'empty', n: 0 });
  });

  it('una categoria solo en el baseline deja la automatica sin tickets', () => {
    const [row] = buildCategoryComparison(cohort('automatic', {}), cohort('baseline', { Acceso: stats(8, 15, 40) }), 5);

    expect(row.automatic).toMatchObject({ state: 'empty', n: 0 });
    expect(row.baseline.state).toBe('ok');
  });

  it('distingue sin tickets (0) de n insuficiente (entre 1 y min_sample menos 1)', () => {
    const rows = buildCategoryComparison(
      cohort('automatic', { A: stats(0), B: stats(4) }),
      cohort('baseline', { A: stats(4), B: stats(0) }),
      5,
    );

    expect(rows.find((row) => row.category === 'A')).toMatchObject({
      automatic: { state: 'empty', n: 0 },
      baseline: { state: 'insufficient', n: 4 },
    });
    expect(rows.find((row) => row.category === 'B')).toMatchObject({
      automatic: { state: 'insufficient', n: 4 },
      baseline: { state: 'empty', n: 0 },
    });
  });

  it('ordena las categorias por nombre sin distinguir acentos de forma rara', () => {
    const rows = buildCategoryComparison(
      cohort('automatic', { Zeta: stats(6, 1, 2), Álgebra: stats(6, 1, 2) }),
      cohort('baseline', { Beta: stats(6, 1, 2) }),
      5,
    );

    expect(rows.map((row) => row.category)).toEqual(['Álgebra', 'Beta', 'Zeta']);
  });

  it('no une por mayusculas ni espacios: son categorias distintas', () => {
    const rows = buildCategoryComparison(cohort('automatic', { Acceso: stats(6, 1, 2) }), cohort('baseline', { acceso: stats(6, 1, 2) }), 5);

    expect(rows.map((row) => row.category).sort()).toEqual(['Acceso', 'acceso']);
  });

  it('sin cohortes devuelve una lista vacia', () => {
    expect(buildCategoryComparison(undefined, undefined, 5)).toEqual([]);
  });
});

describe('cierre por categoria', () => {
  function withClosure(key: string, rows: Record<string, [TimeStats, TimeStats]>): CohortResponseTimes {
    return {
      ...cohort(key, {}),
      by_category: Object.entries(rows).map(([category, [firstResponse, closure]]) => ({
        category,
        tickets: firstResponse.count,
        first_response: firstResponse,
        closure,
      })),
    };
  }

  it('cada lado trae su cierre con sus propios estados', () => {
    const [row] = buildCategoryComparison(
      withClosure('automatic', { Acceso: [stats(12, 20, 40), stats(10, 600, 1800)] }),
      withClosure('baseline', { Acceso: [stats(30, 3000, 9000), stats(3, null, null)] }),
      5,
    );

    expect(row.automaticClosure).toMatchObject({ state: 'ok', n: 10, median: '10 min', p90: '30 min' });
    expect(row.baselineClosure).toMatchObject({ state: 'insufficient', n: 3 });
  });

  it('un lado ausente tiene cierre vacio y 0 tickets', () => {
    const [row] = buildCategoryComparison(withClosure('automatic', { Acceso: [stats(12, 20, 40), stats(10, 600, 1800)] }), undefined, 5);

    expect(row.baselineClosure).toMatchObject({ state: 'empty', n: 0 });
    expect(row.baselineTickets).toBe(0);
    expect(row.automaticTickets).toBe(12);
  });
});

describe('baselineHasTickets', () => {
  it('true solo con tickets en el baseline', () => {
    expect(baselineHasTickets(cohort('baseline', {}, 3))).toBe(true);
    expect(baselineHasTickets(cohort('baseline', {}, 0))).toBe(false);
    expect(baselineHasTickets(undefined)).toBe(false);
  });
});
