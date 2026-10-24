import type { EChartsCoreOption } from 'echarts/core';
import { parseIsoDateLocal } from '../../dashboard/period';
import { formatDuration } from './response-times-format';
import { Granularity, SeriesPoint } from './time-series';

export interface SeriesChartColors {
  // Color de la cohorte elegida, para las dos lineas
  line: string;
  target: string;
  text: string;
  grid: string;
  // Relleno de los marcadores huecos
  surface: string;
}

export interface SeriesChartInput {
  points: SeriesPoint[];
  granularity: Granularity;
  minSample: number;
  targetSeconds: number | null;
  colors: SeriesChartColors;
}

// Texto del grafico: nunca por debajo de 14 px.
const CHART_FONT_SIZE = 14;

// Desde esta relacion entre el valor mas grande y el mas chico (incluido el
// objetivo) un eje lineal aplasta lo chico, y se pasa a escala logaritmica.
export const LOG_RATIO_THRESHOLD = 20;

// Base 60: las marcas del eje caen en 1 s, 1 min, 1 h, que se leen solas.
const LOG_BASE = 60;

// Saltos de eje que se leen bien como duracion: 30 s, 1 min, 5 min, 1 h...
const LINEAR_INTERVALS = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 14400, 21600, 43200, 86400];
const MAX_LINEAR_TICKS = 6;
const AXIS_HEADROOM = 1.1;

const DAY_FORMATTER = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' });

// El mes abreviado de Intl puede traer un punto segun el entorno ("oct."):
// se saca para que quede "24 oct".
function shortDay(day: string): string {
  return DAY_FORMATTER.format(parseIsoDateLocal(day)).replace('.', '');
}

export function formatSeriesLabel(key: string, granularity: Granularity): string {
  return granularity === 'weekly' ? `Semana del ${shortDay(key)}` : shortDay(key);
}

function ticketsWord(count: number): string {
  return count === 1 ? 'ticket' : 'tickets';
}

// Lineas del tooltip de un punto. Con pocos tickets lo dice con el n y el
// minimo, y aun asi muestra los valores, que son orientativos.
export function seriesTooltipLines(point: SeriesPoint, granularity: Granularity, minSample: number): string[] {
  const lines = [formatSeriesLabel(point.key, granularity)];

  if (point.count === 0) {
    lines.push(granularity === 'weekly' ? 'Sin tickets esta semana' : 'Sin tickets este día');
    return lines;
  }

  if (point.p50 !== null) lines.push(`Mediana: ${formatDuration(point.p50)}`);
  if (point.p90 !== null) lines.push(`P90: ${formatDuration(point.p90)}`);
  lines.push(`Tickets: ${point.count}`);
  if (point.lowSample) {
    lines.push(`n insuficiente: ${point.count} ${ticketsWord(point.count)}, el mínimo es ${minSample}`);
  }
  return lines;
}

export const LOG_SCALE_NOTE =
  'Escala logarítmica: las diferencias entre valores chicos y grandes se muestran en proporción, no en tamaño absoluto.';

// note sale de la misma decision que el tipo de eje, asi que la nota solo
// existe cuando el eje es logaritmico.
export type YAxisScale =
  | { kind: 'linear'; max: number; interval: number; note: null }
  | { kind: 'log'; min: number; max: number; note: string };

// Elige el eje Y a partir de todos los valores que tienen que verse, el
// objetivo incluido.
export function chooseYAxisScale(values: number[]): YAxisScale {
  const positives = values.filter((value) => value > 0);
  if (positives.length === 0) return { kind: 'linear', max: 60, interval: 10, note: null };

  const lowest = Math.min(...positives);
  const highest = Math.max(...positives);

  if (highest / lowest >= LOG_RATIO_THRESHOLD) {
    const logOf = (value: number) => Math.log(value) / Math.log(LOG_BASE);
    return {
      kind: 'log',
      min: Math.pow(LOG_BASE, Math.floor(logOf(lowest))),
      max: Math.pow(LOG_BASE, Math.ceil(logOf(highest * 1.05))),
      note: LOG_SCALE_NOTE,
    };
  }

  const target = highest * AXIS_HEADROOM;
  const interval =
    LINEAR_INTERVALS.find((candidate) => target / candidate <= MAX_LINEAR_TICKS) ??
    Math.ceil(target / MAX_LINEAR_TICKS / 86400) * 86400;
  return { kind: 'linear', max: Math.ceil(target / interval) * interval, interval, note: null };
}

function pointValue(value: number | null, hollow: boolean, colors: SeriesChartColors) {
  if (value === null) return null;
  return {
    value,
    symbol: 'circle',
    // Hueco: relleno del color de la superficie y borde del color de la linea
    itemStyle: hollow ? { color: colors.surface, borderColor: colors.line, borderWidth: 2 } : { color: colors.line },
  };
}

// Escala del eje Y de una serie. La usan el grafico y la pantalla (para la
// nota), de modo que lo que se dibuja y lo que se avisa no se desincronicen.
export function resolveSeriesScale(points: SeriesPoint[], targetSeconds: number | null): YAxisScale {
  const values = points.flatMap((point) => [point.p50, point.p90]).filter((value): value is number => value !== null);
  if (targetSeconds !== null) values.push(targetSeconds);
  return chooseYAxisScale(values);
}

export function buildSeriesChartOptions(input: SeriesChartInput): EChartsCoreOption {
  const { points, granularity, minSample, targetSeconds, colors } = input;

  const scale = resolveSeriesScale(points, targetSeconds);

  const yAxis =
    scale.kind === 'log'
      ? { type: 'log', logBase: LOG_BASE, min: scale.min, max: scale.max }
      : { type: 'value', min: 0, max: scale.max, interval: scale.interval };

  const targetMarkLine =
    targetSeconds === null
      ? {}
      : {
          markLine: {
            silent: true,
            symbol: 'none',
            animation: false,
            lineStyle: { color: colors.target, type: 'solid', width: 1.5 },
            label: {
              show: true,
              formatter: `Objetivo: ${formatDuration(targetSeconds)}`,
              position: 'insideEndTop',
              fontSize: CHART_FONT_SIZE,
              color: colors.target,
            },
            data: [{ yAxis: targetSeconds }],
          },
        };

  return {
    animation: false,
    tooltip: {
      trigger: 'axis',
      textStyle: { fontSize: CHART_FONT_SIZE },
      formatter: (params: { dataIndex: number }[]) => {
        const point = points[params[0]?.dataIndex ?? -1];
        return point ? seriesTooltipLines(point, granularity, minSample).join('<br/>') : '';
      },
    },
    legend: { data: ['Mediana', 'P90'], bottom: 0, textStyle: { fontSize: CHART_FONT_SIZE, color: colors.text } },
    grid: { left: 8, right: 16, top: 24, bottom: 48, containLabel: true },
    xAxis: {
      type: 'category',
      data: points.map((point) => formatSeriesLabel(point.key, granularity)),
      axisLabel: { fontSize: CHART_FONT_SIZE, color: colors.text, hideOverlap: true },
      axisLine: { lineStyle: { color: colors.grid } },
    },
    yAxis: {
      ...yAxis,
      axisLabel: { fontSize: CHART_FONT_SIZE, color: colors.text, formatter: (value: number) => formatDuration(value) },
      splitLine: { lineStyle: { color: colors.grid } },
    },
    series: [
      {
        name: 'Mediana',
        type: 'line',
        connectNulls: false,
        symbolSize: 9,
        lineStyle: { color: colors.line, type: 'solid', width: 3 },
        itemStyle: { color: colors.line },
        data: points.map((point) => pointValue(point.p50, point.lowSample, colors)),
        ...targetMarkLine,
      },
      {
        name: 'P90',
        type: 'line',
        connectNulls: false,
        symbolSize: 9,
        lineStyle: { color: colors.line, type: 'dashed', width: 2 },
        itemStyle: { color: colors.line },
        data: points.map((point) => pointValue(point.p90, point.lowSample, colors)),
      },
    ],
  };
}
