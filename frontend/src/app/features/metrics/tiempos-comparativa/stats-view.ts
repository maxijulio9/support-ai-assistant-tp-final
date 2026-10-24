import { formatDuration } from './response-times-format';
import { TimeStats } from '../../../api/models/time-stats';

// Por debajo de esta cantidad de tickets el p90 se muestra como orientativo.
export const P90_INDICATIVE_BELOW = 20;

export type StatsState = 'ok' | 'insufficient' | 'empty';

export interface StatsView {
  state: StatsState;
  n: number;
  median: string | null;
  p90: string | null;
  p90Indicative: boolean;
}

// El backend ya manda los percentiles en null cuando count no llega a
// min_sample, pero el estado sale de count para no depender de eso: sin
// tickets es "empty", con pocos es "insufficient".
export function statsState(stats: TimeStats, minSample: number): StatsState {
  if (stats.count <= 0) return 'empty';
  if (stats.count < minSample) return 'insufficient';
  return 'ok';
}

function durationOrNull(seconds: number | null): string | null {
  return seconds === null ? null : formatDuration(seconds);
}

export function buildStatsView(stats: TimeStats, minSample: number): StatsView {
  const state = statsState(stats, minSample);
  if (state !== 'ok') {
    return { state, n: stats.count, median: null, p90: null, p90Indicative: false };
  }
  return {
    state,
    n: stats.count,
    median: durationOrNull(stats.p50_seconds),
    p90: durationOrNull(stats.p90_seconds),
    p90Indicative: stats.count < P90_INDICATIVE_BELOW,
  };
}

// Texto de una celda que no tiene cifras: pocos tickets o ninguno.
export function statsPlaceholder(view: StatsView): string | null {
  if (view.state === 'insufficient') return 'n insuficiente';
  if (view.state === 'empty') return 'Sin tickets';
  return null;
}
