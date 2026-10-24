import { CohortLike, StatsLike } from './response-times.types';

export type Granularity = 'daily' | 'weekly';

export interface SeriesPoint {
  // Fecha (diaria) o lunes de la semana (semanal), AAAA-MM-DD en el huso del filtro
  key: string;
  count: number;
  p50: number | null;
  p90: number | null;
  // Hay datos pero menos que min_sample: se dibuja distinto y el tooltip
  // aclara el n. daily y weekly no aplican el minimo en el backend.
  lowSample: boolean;
}

function toPoint(key: string, stats: StatsLike, minSample: number): SeriesPoint {
  return {
    key,
    count: stats.count,
    p50: stats.count > 0 ? stats.p50_seconds : null,
    p90: stats.count > 0 ? stats.p90_seconds : null,
    lowSample: stats.count > 0 && stats.count < minSample,
  };
}

// Orden cronologico: las claves son fechas ISO, que ordenan como texto.
export function buildSeriesPoints(cohort: CohortLike | undefined, granularity: Granularity, minSample: number): SeriesPoint[] {
  if (!cohort) return [];

  const points =
    granularity === 'daily'
      ? cohort.daily.map((point) => toPoint(point.date, point.first_response, minSample))
      : cohort.weekly.map((point) => toPoint(point.week_start, point.first_response, minSample));

  return points.sort((a, b) => a.key.localeCompare(b.key));
}

// Sin ningun punto con dato la pantalla muestra un estado vacio en lugar de
// un grafico sin lineas.
export function hasSeriesData(points: SeriesPoint[]): boolean {
  return points.some((point) => point.count > 0 && (point.p50 !== null || point.p90 !== null));
}
