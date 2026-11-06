import { EvolutionPoint } from '../../dashboard/auto-publish-evolution';

export type MiniMetric = 'auto-publish' | 'escalate' | 'total' | 'confidence';
type MiniUnit = 'percent' | 'count' | 'score';

interface MiniConfig {
  title: string;
  unit: MiniUnit;
  // Valor del dia y, en los porcentajes, la cantidad que hay detras
  value: (point: EvolutionPoint) => number | null;
  count?: (point: EvolutionPoint) => number;
}

const CONFIG: Record<MiniMetric, MiniConfig> = {
  'auto-publish': {
    title: 'Resolución automática',
    unit: 'percent',
    value: (point) => percentOf(point.autoPublish, point.total),
    count: (point) => point.autoPublish,
  },
  escalate: {
    title: 'Escalamiento',
    unit: 'percent',
    value: (point) => percentOf(point.escalate, point.total),
    count: (point) => point.escalate,
  },
  total: { title: 'Total de solicitudes', unit: 'count', value: (point) => (point.total > 0 ? point.total : null) },
  confidence: { title: 'Confianza media', unit: 'score', value: (point) => point.avgConfidence },
};

// Entero de 0 a 100; null si el dia no tuvo solicitudes (no es 0 %, es un
// dia sin dato)
function percentOf(count: number, total: number): number | null {
  return total > 0 ? Math.round((count / total) * 100) : null;
}

export interface MiniChartPoint {
  label: string;
  // null: no hay dato ese dia, la linea lo salta
  value: number | null;
  // Solicitudes del dia y cuantas son de la metrica (solo en porcentajes)
  total: number;
  count: number | null;
}

export interface MiniChart {
  metric: MiniMetric;
  points: MiniChartPoint[];
  startLabel: string;
  endLabel: string;
  // Maximo del periodo, para el centro de la linea de texto
  maxText: string;
  // Rango del eje Y, ajustado a los datos con margen
  yMin: number;
  yMax: number;
  // Resumen para lectores de pantalla
  summary: string;
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

function formatValue(unit: MiniUnit, value: number): string {
  if (unit === 'percent') return `${value} %`;
  if (unit === 'score') return value.toFixed(2).replace('.', ',');
  return String(value);
}

// Rango del eje: el de los datos mas un margen. Con un solo valor (o todos
// iguales) el margen sale del propio valor, para que la linea no quede pegada
// a un borde.
export function paddedRange(values: number[]): { min: number; max: number } {
  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = high - low;
  const pad = span > 0 ? span * 0.15 : Math.max(Math.abs(high) * 0.1, 0.01);
  return { min: low - pad, max: high + pad };
}

// Arma el minigrafico de una tarjeta a partir de los puntos diarios que ya
// calcula la evolucion de Inicio. null si ningun dia tiene dato.
export function buildMiniChart(metric: MiniMetric, evolution: EvolutionPoint[]): MiniChart | null {
  const config = CONFIG[metric];

  const points: MiniChartPoint[] = evolution.map((point) => ({
    label: point.label,
    value: config.value(point),
    total: point.total,
    count: config.count ? config.count(point) : null,
  }));
  const known = points.filter((point) => point.value !== null);
  if (known.length === 0) return null;

  const peak = known.reduce((best, point) => ((point.value as number) > (best.value as number) ? point : best));
  const last = known[known.length - 1];
  const startLabel = points[0].label;
  const endLabel = points[points.length - 1].label;
  const peakText = formatValue(config.unit, peak.value as number);
  const range = paddedRange(known.map((point) => point.value as number));

  return {
    metric,
    points,
    startLabel,
    endLabel,
    maxText: config.unit === 'count' ? `máx. ${peakText} por día` : `máx. ${peakText}`,
    yMin: range.min,
    yMax: range.max,
    summary: `${config.title}, del ${startLabel} al ${endLabel}. Máximo: ${peakText}, el ${peak.label}. Último valor, ${last.label}: ${tooltipValue(config.unit, last)}.`,
  };
}

// Valor de un dia con su detalle: en los porcentajes, cuantas solicitudes hay
// detras
function tooltipValue(unit: MiniUnit, point: MiniChartPoint): string {
  const value = formatValue(unit, point.value as number);
  if (unit === 'percent') {
    return `${value} (${point.count} de ${point.total} ${plural(point.total, 'solicitud', 'solicitudes')})`;
  }
  if (unit === 'count') return `${value} ${plural(point.value as number, 'solicitud', 'solicitudes')}`;
  return value;
}

// Texto del tooltip de un dia
export function miniTooltip(chart: MiniChart, index: number): string {
  const point = chart.points[index];
  if (!point) return '';
  const unit = CONFIG[chart.metric].unit;

  if (point.value === null) {
    return unit === 'score' && point.total > 0
      ? `${point.label}: sin puntaje de confianza`
      : `${point.label}: sin solicitudes`;
  }
  return `${point.label}: ${tooltipValue(unit, point)}`;
}
