import { formatDuration } from './response-times-format';
import { TimeStats } from '../../../api/models/time-stats';

// Por debajo de esta cantidad de tickets el p90 se muestra como orientativo.
export const P90_INDICATIVE_BELOW = 20;

// Texto de una celda sin cifras por muestra chica, y su explicacion. El minimo
// sale del contrato, no se fija aca.
export const NO_DATA_TEXT = 'Sin datos';

export function noDataExplanation(minSample: number): string {
  return `Con menos de ${minSample} tickets no se calcula este valor.`;
}

// Nombre accesible del aviso: lo que lee el lector de pantalla en lugar del texto visible
export function noDataLabel(minSample: number): string {
  return `${NO_DATA_TEXT}: con menos de ${minSample} tickets no se calcula`;
}

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
  if (view.state === 'insufficient') return NO_DATA_TEXT;
  if (view.state === 'empty') return 'Sin tickets';
  return null;
}
