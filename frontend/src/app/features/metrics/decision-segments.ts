import { DecisionTone, decisionStatus, STATUS_FILTER_OPTIONS } from '../interactions/interaction-status';

// Los 6 conteos por decision que trae tanto MetricsSummaryResponse como
// DailyMetric, con el mismo nombre de campo en los dos: una interfaz
// estructural alcanza para que decisionSegmentValue sirva para cualquiera
// de los dos sin que una dependa de la otra.
export interface DecisionSegmentCounts {
  auto_publish_count: number;
  needs_review_count: number;
  escalate_count: number;
  request_info_count: number;
  resolved_count: number;
  resolved_externally_count: number;
}

export type DecisionSegmentTone = DecisionTone | 'resolved';

export interface DecisionSegment {
  key: string;
  label: string;
  tone: DecisionSegmentTone;
}

const RESOLVED_GROUP_KEY = 'RESOLVED_GROUP';

// Las 4 decisiones de siempre, mismo orden y color que decisionStatus, mas
// un quinto segmento que agrupa las dos decisiones que decisionStatus no
// cubre (resolved_count y resolved_externally_count no son parte de las 4
// decisiones mapeadas en interaction-status.ts).
export const DECISION_SEGMENTS: DecisionSegment[] = [
  ...STATUS_FILTER_OPTIONS.map((option) => ({
    key: option.value,
    label: option.label,
    tone: decisionStatus(option.value).tone as DecisionSegmentTone,
  })),
  { key: RESOLVED_GROUP_KEY, label: 'Resueltas (incluye externas)', tone: 'resolved' as DecisionSegmentTone },
];

const COUNT_FIELD: Record<string, keyof DecisionSegmentCounts> = {
  AUTO_PUBLISH: 'auto_publish_count',
  NEEDS_REVIEW: 'needs_review_count',
  ESCALATE: 'escalate_count',
  REQUEST_INFO: 'request_info_count',
};

export function decisionSegmentValue(counts: DecisionSegmentCounts, key: string): number {
  if (key === RESOLVED_GROUP_KEY) return counts.resolved_count + counts.resolved_externally_count;
  return (counts[COUNT_FIELD[key]] as number) ?? 0;
}

// Porcentaje de cada valor sobre el total, redondeado a 1 decimal, con la
// diferencia de redondeo absorbida por el segmento de mayor cantidad (en
// empate, el primero) para que la suma visible de siempre 100,0. Con
// total <= 0 no divide: todos quedan en 0.
export function roundedSegmentPercentages(values: number[], total: number): number[] {
  if (total <= 0) return values.map(() => 0);

  const rounded = values.map((value) => Math.round((value / total) * 1000) / 10);
  const sum = Math.round(rounded.reduce((acc, value) => acc + value, 0) * 10) / 10;
  const diff = Math.round((100 - sum) * 10) / 10;

  if (diff !== 0) {
    const largestIndex = values.reduce((maxIndex, value, index) => (value > values[maxIndex] ? index : maxIndex), 0);
    rounded[largestIndex] = Math.round((rounded[largestIndex] + diff) * 10) / 10;
  }

  return rounded;
}
