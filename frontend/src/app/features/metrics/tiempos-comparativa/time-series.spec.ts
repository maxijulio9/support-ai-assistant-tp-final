import { buildSeriesPoints, hasSeriesData } from './time-series';
import { CohortResponseTimes } from '../../../api/models/cohort-response-times';
import { TimeStats } from '../../../api/models/time-stats';

function stats(count: number, p50: number | null = null, p90: number | null = null): TimeStats {
  return { count, mean_seconds: p50, p50_seconds: p50, p90_seconds: p90, within_target_rate: null };
}

function cohort(daily: [string, TimeStats][], weekly: [string, TimeStats][] = []): CohortResponseTimes {
  return {
    cohort: 'automatic',
    first_response_kind: 'answer',
    closure_basis: 'detected_confirmation',
    tickets: 0,
    first_response: stats(0),
    closure: stats(0),
    outcomes: [],
    by_category: [],
    daily: daily.map(([date, firstResponse]) => ({ date, first_response: firstResponse })),
    weekly: weekly.map(([week_start, firstResponse]) => ({ week_start, first_response: firstResponse })),
  };
}

describe('buildSeriesPoints', () => {
  it('sin cohorte no hay puntos', () => {
    expect(buildSeriesPoints(undefined, 'weekly', 5)).toEqual([]);
  });

  it('daily usa la fecha y weekly usa el lunes de la semana', () => {
    const data = cohort([['2026-10-26', stats(6, 10, 20)]], [['2026-10-26', stats(9, 12, 30)]]);

    expect(buildSeriesPoints(data, 'daily', 5)[0]).toMatchObject({ key: '2026-10-26', count: 6, p50: 10, p90: 20 });
    expect(buildSeriesPoints(data, 'weekly', 5)[0]).toMatchObject({ key: '2026-10-26', count: 9, p50: 12, p90: 30 });
  });

  it('marca como muestra baja los puntos con count menor que min_sample', () => {
    const points = buildSeriesPoints(cohort([['2026-10-24', stats(1, 10, 10)], ['2026-10-25', stats(5, 10, 20)]]), 'daily', 5);

    expect(points.map((point) => point.lowSample)).toEqual([true, false]);
  });

  it('un punto con 1 ticket conserva sus percentiles, que el backend manda desde 1', () => {
    const [point] = buildSeriesPoints(cohort([['2026-10-24', stats(1, 42, 42)]]), 'daily', 5);

    expect(point).toMatchObject({ count: 1, p50: 42, p90: 42, lowSample: true });
  });

  it('un punto con count 0 queda con percentiles null y sin marca de muestra baja', () => {
    const [point] = buildSeriesPoints(cohort([['2026-10-24', stats(0)]]), 'daily', 5);

    expect(point).toMatchObject({ count: 0, p50: null, p90: null, lowSample: false });
  });

  it('usa el min_sample recibido', () => {
    const data = cohort([['2026-10-24', stats(7, 10, 20)]]);

    expect(buildSeriesPoints(data, 'daily', 5)[0].lowSample).toBe(false);
    expect(buildSeriesPoints(data, 'daily', 10)[0].lowSample).toBe(true);
  });

  it('ordena cronologicamente aunque lleguen desordenados', () => {
    const points = buildSeriesPoints(cohort([['2026-10-26', stats(5, 1, 1)], ['2026-10-24', stats(5, 1, 1)]]), 'daily', 5);

    expect(points.map((point) => point.key)).toEqual(['2026-10-24', '2026-10-26']);
  });
});

describe('hasSeriesData', () => {
  it('false sin puntos', () => {
    expect(hasSeriesData([])).toBe(false);
  });

  it('false cuando todos los puntos tienen count 0', () => {
    expect(hasSeriesData(buildSeriesPoints(cohort([['2026-10-24', stats(0)]]), 'daily', 5))).toBe(false);
  });

  it('true con al menos un punto con datos, aunque sea de muestra baja', () => {
    expect(hasSeriesData(buildSeriesPoints(cohort([['2026-10-24', stats(1, 10, 10)]]), 'daily', 5))).toBe(true);
  });
});
