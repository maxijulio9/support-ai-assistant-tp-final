import {
  buildStatsView,
  NO_DATA_TEXT,
  noDataExplanation,
  noDataLabel,
  P90_INDICATIVE_BELOW,
  statsPlaceholder,
  statsState,
} from './stats-view';
import { TimeStats } from '../../../api/models/time-stats';

function stats(count: number, p50: number | null = null, p90: number | null = null): TimeStats {
  return { count, mean_seconds: p50, p50_seconds: p50, p90_seconds: p90, within_target_rate: null };
}

describe('statsState', () => {
  it('count 0 es empty', () => {
    expect(statsState(stats(0), 5)).toBe('empty');
  });

  it.each([1, 4])('count %s con min_sample 5 es insufficient', (count) => {
    expect(statsState(stats(count), 5)).toBe('insufficient');
  });

  it.each([5, 6, 100])('count %s con min_sample 5 es ok', (count) => {
    expect(statsState(stats(count, 10, 20), 5)).toBe('ok');
  });

  it('usa el min_sample recibido, no un valor fijo', () => {
    expect(statsState(stats(7, 10, 20), 10)).toBe('insufficient');
  });
});

describe('buildStatsView', () => {
  it('ok: formatea mediana y p90', () => {
    expect(buildStatsView(stats(30, 125, 3900), 5)).toEqual({
      state: 'ok',
      n: 30,
      median: '2 min 5 s',
      p90: '1 h 5 min',
      p90Indicative: false,
    });
  });

  it('insufficient: sin cifras pero con el n', () => {
    expect(buildStatsView(stats(3), 5)).toEqual({ state: 'insufficient', n: 3, median: null, p90: null, p90Indicative: false });
  });

  it('empty: sin cifras y n 0', () => {
    expect(buildStatsView(stats(0), 5)).toEqual({ state: 'empty', n: 0, median: null, p90: null, p90Indicative: false });
  });

  it('el p90 es orientativo por debajo del umbral y no lo es desde el umbral', () => {
    expect(buildStatsView(stats(P90_INDICATIVE_BELOW - 1, 10, 20), 5).p90Indicative).toBe(true);
    expect(buildStatsView(stats(P90_INDICATIVE_BELOW, 10, 20), 5).p90Indicative).toBe(false);
  });

  it('con count suficiente pero un percentil null no inventa un valor', () => {
    const view = buildStatsView(stats(10, 10, null), 5);

    expect(view.median).toBe('10 s');
    expect(view.p90).toBeNull();
  });
});

describe('statsPlaceholder', () => {
  it('distingue pocos tickets de ningun ticket', () => {
    expect(statsPlaceholder(buildStatsView(stats(3), 5))).toBe('Sin datos');
    expect(statsPlaceholder(buildStatsView(stats(0), 5))).toBe('Sin tickets');
  });

  it('con datos suficientes no hay placeholder', () => {
    expect(statsPlaceholder(buildStatsView(stats(10, 5, 9), 5))).toBeNull();
  });
});

describe('texto de sin datos por muestra chica', () => {
  it('el texto visible es Sin datos', () => {
    expect(NO_DATA_TEXT).toBe('Sin datos');
  });

  it('la explicacion usa el minimo del contrato', () => {
    expect(noDataExplanation(5)).toBe('Con menos de 5 tickets no se calcula este valor.');
    expect(noDataExplanation(10)).toBe('Con menos de 10 tickets no se calcula este valor.');
  });

  it('el nombre accesible junta el texto y el motivo', () => {
    expect(noDataLabel(5)).toBe('Sin datos: con menos de 5 tickets no se calcula');
  });

  it('ningun texto usa guiones largos ni el viejo n insuficiente', () => {
    for (const text of [NO_DATA_TEXT, noDataExplanation(5), noDataLabel(5)]) {
      expect(text).not.toMatch(/[\u2013\u2014]|n insuficiente/);
    }
  });
});
