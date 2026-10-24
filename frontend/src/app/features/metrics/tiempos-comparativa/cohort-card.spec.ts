import { MAIN_COHORTS, SYSTEM_RESPONSE_COHORTS, buildCohortCard, pickCohorts } from './cohort-card';
import { CohortLike, StatsLike } from './response-times.types';

function stats(count: number, p50: number | null, p90: number | null, rate: number | null = null): StatsLike {
  return { count, mean_seconds: p50, p50_seconds: p50, p90_seconds: p90, within_target_rate: rate };
}

function cohort(key: string, firstResponse: StatsLike, tickets = firstResponse.count, kind = 'answer'): CohortLike {
  return {
    cohort: key,
    first_response_kind: kind,
    closure_basis: 'detected_confirmation',
    tickets,
    first_response: firstResponse,
    closure: stats(0, null, null),
    outcomes: [],
    by_category: [],
    daily: [],
    weekly: [],
  };
}

describe('buildCohortCard', () => {
  it('cohorte con datos y objetivo: n, mediana, p90 y porcentaje dentro del objetivo', () => {
    const card = buildCohortCard(cohort('automatic', stats(40, 28, 90, 0.825)), 5, 30);

    expect(card.label).toBe('Automática');
    expect(card.tickets).toBe(40);
    expect(card.firstResponse).toMatchObject({ state: 'ok', n: 40, median: '28 s', p90: '1 min 30 s', p90Indicative: false });
    expect(card.withinTarget).toEqual({ text: '83%', label: 'dentro del objetivo' });
  });

  it('sin objetivo no hay porcentaje aunque el backend lo mande', () => {
    expect(buildCohortCard(cohort('automatic', stats(40, 28, 90, 0.8)), 5, null).withinTarget).toBeNull();
  });

  it('con objetivo pero sin tasa no hay porcentaje', () => {
    expect(buildCohortCard(cohort('automatic', stats(40, 28, 90, null)), 5, 30).withinTarget).toBeNull();
  });

  it('con n insuficiente no hay porcentaje y se conserva el n', () => {
    const card = buildCohortCard(cohort('automatic', stats(3, null, null, 0.6)), 5, 30);

    expect(card.firstResponse.state).toBe('insufficient');
    expect(card.firstResponse.n).toBe(3);
    expect(card.withinTarget).toBeNull();
  });

  it('cohorte vacia: estado empty y n 0', () => {
    const card = buildCohortCard(cohort('baseline', stats(0, null, null), 0), 5, null);

    expect(card.firstResponse).toMatchObject({ state: 'empty', n: 0 });
    expect(card.label).toBe('Atención manual previa');
  });

  it('tickets incluye los que no tienen dato de tiempo', () => {
    const card = buildCohortCard(cohort('reviewed', stats(2, null, null), 9), 5, null);

    expect(card.tickets).toBe(9);
    expect(card.firstResponse.n).toBe(2);
  });

  it('el p90 con menos de 20 tickets es orientativo', () => {
    expect(buildCohortCard(cohort('reviewed', stats(12, 40, 300)), 5, null).firstResponse.p90Indicative).toBe(true);
  });

  it('escalated e info_requested rotulan el porcentaje como acuse y pedido', () => {
    const escalated = buildCohortCard(cohort('escalated', stats(10, 5, 9, 0.9), 10, 'acknowledgment'), 5, 30);
    const info = buildCohortCard(cohort('info_requested', stats(10, 5, 9, 0.5), 10, 'information_request'), 5, 30);

    expect(escalated.withinTarget?.label).toBe('dentro del objetivo (acuse)');
    expect(escalated.kindLabel).toBe('Acuse de recibo');
    expect(info.withinTarget?.label).toBe('dentro del objetivo (pedido)');
    expect(info.kindLabel).toBe('Pedido de información');
  });
});

describe('pickCohorts', () => {
  const all = ['automatic', 'reviewed', 'escalated', 'info_requested', 'baseline'].map((key) => cohort(key, stats(0, null, null)));

  it('separa la fila principal de las respuestas del sistema que no son solucion', () => {
    expect(pickCohorts(all, MAIN_COHORTS).map((item) => item.cohort)).toEqual(['automatic', 'reviewed', 'baseline']);
    expect(pickCohorts(all, SYSTEM_RESPONSE_COHORTS).map((item) => item.cohort)).toEqual(['escalated', 'info_requested']);
  });

  it('una cohorte ausente no rompe', () => {
    expect(pickCohorts([], MAIN_COHORTS)).toEqual([]);
  });
});
