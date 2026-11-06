import { DailyMetric } from '../../api/models/daily-metric';
import { formatShortDay } from '../../shared/format-short-day';
import { rate } from '../../shared/kpi-metrics';
import { DayRange, parseIsoDateLocal, toIsoDate } from './period';

export type EvolutionDays = 7 | 30;

export const EVOLUTION_DAY_OPTIONS: readonly EvolutionDays[] = [7, 30];

export const DEFAULT_EVOLUTION_DAYS: EvolutionDays = 7;

export interface EvolutionPoint {
  date: string;
  label: string;
  autoPublish: number;
  escalate: number;
  // Promedio de confianza del dia; null si ningun puntaje ese dia
  avgConfidence: number | null;
  // Solicitudes que no se resolvieron automaticamente
  rest: number;
  total: number;
  // Entero de 0 a 100. null si ese dia no tuvo solicitudes: no es 0 %, es un
  // dia sin dato y el grafico deja un hueco.
  percent: number | null;
}

export interface EvolutionPeriod {
  autoPublish: number;
  total: number;
  percent: number | null;
}

// Ultimos N dias calendario incluyendo hoy.
export function evolutionRange(days: EvolutionDays, now: Date = new Date()): DayRange {
  const to = toIsoDate(now);
  const from = toIsoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1)));
  return { from, to };
}

// Un punto por cada dia del rango, tenga o no fila en la respuesta.
export function buildEvolutionPoints(range: DayRange, days: DailyMetric[]): EvolutionPoint[] {
  const byDate = new Map(days.map((day) => [day.date, day]));
  const start = parseIsoDateLocal(range.from);
  const end = parseIsoDateLocal(range.to);
  const points: EvolutionPoint[] = [];

  for (let cursor = start; cursor <= end; cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1)) {
    const date = toIsoDate(cursor);
    const metric = byDate.get(date);
    const autoPublish = metric?.auto_publish_count ?? 0;
    const total = metric?.total_interactions ?? 0;
    points.push({
      date,
      label: formatShortDay(date),
      autoPublish,
      escalate: metric?.escalate_count ?? 0,
      avgConfidence: metric?.avg_confidence_score ?? null,
      rest: Math.max(0, total - autoPublish),
      total,
      percent: percentOf(autoPublish, total),
    });
  }
  return points;
}

function percentOf(count: number, total: number): number | null {
  const value = rate(count, total);
  return value === null ? null : Math.round(value * 100);
}

export function hasEvolutionData(points: EvolutionPoint[]): boolean {
  return points.some((point) => point.total > 0);
}

// Totales del periodo elegido; el porcentaje sale de los totales, no del
// promedio de los porcentajes diarios.
export function evolutionPeriod(points: EvolutionPoint[]): EvolutionPeriod {
  const autoPublish = points.reduce((sum, point) => sum + point.autoPublish, 0);
  const total = points.reduce((sum, point) => sum + point.total, 0);
  return { autoPublish, total, percent: percentOf(autoPublish, total) };
}

export interface EvolutionHeadline {
  // Dato clave, en texto grande
  main: string;
  // Aclaracion en gris, null si no hay solicitudes
  detail: string | null;
}

export function evolutionHeadline(period: EvolutionPeriod, days: EvolutionDays): EvolutionHeadline {
  if (period.total === 0 || period.percent === null) {
    return { main: 'Sin solicitudes en este período', detail: null };
  }
  return {
    main: `${period.percent} % resuelto automáticamente`,
    detail: `(${period.autoPublish} de ${period.total} solicitudes en los últimos ${days} días)`,
  };
}

export function dayTooltip(point: EvolutionPoint): string {
  if (point.total === 0 || point.percent === null) return `${point.label}: Sin solicitudes`;
  return `${point.label}: ${point.autoPublish} de ${point.total} resueltas automáticamente (${point.percent} %)`;
}

// Resumen en texto del grafico, para lectores de pantalla.
export function evolutionSummary(points: EvolutionPoint[]): string {
  if (points.length === 0) return 'Sin datos en el rango.';
  const first = points[0];
  const last = points[points.length - 1];
  const range = `del ${first.label} al ${last.label}`;
  const period = evolutionPeriod(points);
  if (period.total === 0) return `Sin solicitudes ${range}.`;

  const busiest = points.reduce((best, point) => (point.total > best.total ? point : best));
  const gaps = points.filter((point) => point.total === 0).length;

  const parts = [
    `Solicitudes por día y cuántas resolvió el sistema sin intervención, ${range}.`,
    `En el período se resolvió automáticamente el ${period.percent} %, ${period.autoPublish} de ${period.total} solicitudes.`,
    `Día con más solicitudes: ${busiest.label}, con ${busiest.total}.`,
  ];
  if (gaps > 0) parts.push(gaps === 1 ? '1 día sin solicitudes.' : `${gaps} días sin solicitudes.`);
  return parts.join(' ');
}
