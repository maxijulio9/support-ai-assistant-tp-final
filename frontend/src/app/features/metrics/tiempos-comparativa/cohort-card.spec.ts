import {
  MAIN_COHORTS,
  SYSTEM_RESPONSE_COHORTS,
  buildCohortCard,
  cohortAccentVar,
  hasAnyTickets,
  pickCohorts,
} from './cohort-card';
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

describe('hasAnyTickets', () => {
  const data = (tickets: number[]) => ({
    timezone: 'x',
    min_sample: 5,
    first_response_target_seconds: null,
    cohorts: tickets.map((count, index) => cohort(`c${index}`, stats(0, null, null), count)),
  });

  it('false cuando todas las cohortes tienen 0 tickets', () => {
    expect(hasAnyTickets(data([0, 0, 0, 0, 0]))).toBe(false);
  });

  it('true con tickets en cualquier cohorte, aunque sea una sola', () => {
    expect(hasAnyTickets(data([0, 0, 0, 0, 1]))).toBe(true);
  });

  it('false sin cohortes', () => {
    expect(hasAnyTickets(data([]))).toBe(false);
  });
});

describe('placeholder y texto de tickets de la tarjeta', () => {
  it('con datos suficientes no hay placeholder', () => {
    expect(buildCohortCard(cohort('automatic', stats(40, 28, 90)), 5, null).placeholder).toBeNull();
  });

  it('n insuficiente explica cuantos hay y cuantos hacen falta', () => {
    const card = buildCohortCard(cohort('automatic', stats(3, null, null)), 5, null);

    expect(card.placeholder?.title).toBe('n insuficiente');
    expect(card.placeholder?.detail).toBe('Hay 3 tickets con tiempo de respuesta y hacen falta al menos 5 para calcular los tiempos.');
  });

  it('con 1 ticket el texto va en singular', () => {
    expect(buildCohortCard(cohort('automatic', stats(1, null, null)), 5, null).placeholder?.detail).toContain('Hay 1 ticket con');
  });

  it('sin tickets en la cohorte dice Sin tickets', () => {
    const card = buildCohortCard(cohort('baseline', stats(0, null, null), 0), 5, null);

    expect(card.placeholder?.title).toBe('Sin tickets');
  });

  it('con tickets pero ninguno con tiempo dice Sin datos de tiempo, no Sin tickets', () => {
    const card = buildCohortCard(cohort('reviewed', stats(0, null, null), 4), 5, null);

    expect(card.placeholder?.title).toBe('Sin datos de tiempo');
    expect(card.placeholder?.detail).toContain('Hay 4 tickets');
  });

  it('el texto de tickets muestra el n y, si difiere, cuantos hay en total', () => {
    expect(buildCohortCard(cohort('automatic', stats(40, 28, 90), 40), 5, null).ticketsText).toBe('40');
    expect(buildCohortCard(cohort('automatic', stats(40, 28, 90), 45), 5, null).ticketsText).toBe('40 con tiempo (de 45)');
  });

  it('la tarjeta incluye la linea de apoyo de la cohorte', () => {
    expect(buildCohortCard(cohort('escalated', stats(0, null, null), 0), 5, null).description.length).toBeGreaterThan(0);
  });
});

describe('cohortAccentVar', () => {
  it('reusa los colores de decision del resto de Metricas', () => {
    expect(cohortAccentVar('automatic')).toBe('--app-color-decision-auto-publish');
    expect(cohortAccentVar('reviewed')).toBe('--app-color-decision-needs-review');
    expect(cohortAccentVar('escalated')).toBe('--app-color-decision-escalate');
    expect(cohortAccentVar('info_requested')).toBe('--app-color-decision-request-info');
  });

  it('la atencion manual previa y una cohorte desconocida usan el color neutro', () => {
    expect(cohortAccentVar('baseline')).toBe('--app-color-decision-other');
    expect(cohortAccentVar('otra')).toBe('--app-color-decision-other');
  });
});

describe('cierre de la tarjeta', () => {
  function withClosure(key: string, basis: string, closure: StatsLike, tickets = closure.count): CohortLike {
    return { ...cohort(key, stats(10, 20, 40), tickets), closure_basis: basis, closure };
  }

  it('con datos suficientes: mediana, p90 y n del cierre, sin placeholder', () => {
    const card = buildCohortCard(withClosure('automatic', 'detected_confirmation', stats(30, 600, 3700)), 5, null);

    expect(card.closure.view).toMatchObject({ state: 'ok', n: 30, median: '10 min', p90: '1 h 1 min', p90Indicative: false });
    expect(card.closure.placeholder).toBeNull();
  });

  it('el p90 del cierre es orientativo bajo 20 tickets', () => {
    const card = buildCohortCard(withClosure('automatic', 'detected_confirmation', stats(12, 600, 900)), 5, null);

    expect(card.closure.view.p90Indicative).toBe(true);
  });

  it('pocos cierres: n insuficiente con el n; ninguno con tickets: Sin cierres; sin tickets: Sin tickets', () => {
    expect(buildCohortCard(withClosure('automatic', 'detected_confirmation', stats(3, null, null)), 5, null).closure.placeholder).toBe(
      'n insuficiente',
    );
    expect(buildCohortCard(withClosure('automatic', 'detected_confirmation', stats(0, null, null), 6), 5, null).closure.placeholder).toBe(
      'Sin cierres',
    );
    expect(buildCohortCard(withClosure('baseline', 'last_customer_comment', stats(0, null, null), 0), 5, null).closure.placeholder).toBe(
      'Sin tickets',
    );
  });

  it('el texto de como se mide sale del closure_basis de cada cohorte', () => {
    const system = buildCohortCard(withClosure('automatic', 'detected_confirmation', stats(10, 1, 2)), 5, null);
    const manual = buildCohortCard(withClosure('baseline', 'last_customer_comment', stats(10, 1, 2)), 5, null);

    expect(system.closure.basisText).toContain('confirmación detectada');
    expect(manual.closure.basisText).toContain('último comentario del cliente según JSM');
  });
});
