export type DecisionTone = 'success' | 'warning' | 'error' | 'neutral';

export interface DecisionStatus {
  label: string;
  tone: DecisionTone;
}

// Valores reales de "decision", definidos en
// backend/app/modules/response_generator/schemas.py:8-11.
const DECISION_STATUS: Record<string, DecisionStatus> = {
  AUTO_PUBLISH: { label: 'Publicada', tone: 'success' },
  NEEDS_REVIEW: { label: 'Pendiente de revisión', tone: 'warning' },
  ESCALATE: { label: 'Escalada', tone: 'error' },
  REQUEST_INFO: { label: 'Información solicitada', tone: 'neutral' },
};

// decision no mapeada: se muestra el texto crudo con tono neutro. decision
// ausente (null): no hay texto crudo para mostrar, se usa un rotulo propio.
export function decisionStatus(decision: string | null): DecisionStatus {
  if (decision === null) return { label: 'Sin estado', tone: 'neutral' };
  return DECISION_STATUS[decision] ?? { label: decision, tone: 'neutral' };
}

// Opciones fijas del filtro de Estado: las 4 decisiones reales del contrato,
// en el mismo orden en que se declaran arriba.
export const STATUS_FILTER_OPTIONS: { value: string; label: string }[] = Object.entries(DECISION_STATUS).map(
  ([value, status]) => ({ value, label: status.label }),
);
