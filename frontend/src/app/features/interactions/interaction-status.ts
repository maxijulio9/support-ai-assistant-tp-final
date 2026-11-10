export type DecisionTone = 'success' | 'warning' | 'error' | 'failed' | 'neutral';

export interface DecisionStatus {
  label: string;
  tone: DecisionTone;
  // Ícono de Material que acompaña al texto cuando el color solo no alcanza
  icon?: string;
}

// Valores reales de "decision", definidos en el schema de decision del
// backend (backend/app/modules/response_generator/schemas.py).
const DECISION_STATUS: Record<string, DecisionStatus> = {
  AUTO_PUBLISH: { label: 'Publicada', tone: 'success' },
  NEEDS_REVIEW: { label: 'Pendiente de revisión', tone: 'warning' },
  ESCALATE: { label: 'Escalada', tone: 'error' },
  REQUEST_INFO: { label: 'Información solicitada', tone: 'neutral' },
  DISCARDED: { label: 'Descartada', tone: 'neutral' },
  // Jira rechazó el comentario después de todos los reintentos
  PUBLISH_FAILED: { label: 'Falló la publicación', tone: 'failed', icon: 'error_outline' },
};

// Un valor sin mapear (por ejemplo una decision nueva del backend) se muestra
// legible y neutro: "UNA_DECISION_FUTURA" pasa a "Una decision futura".
// decision ausente (null) o vacia: no hay texto para mostrar, se usa un rotulo propio.
export function fallbackDecisionLabel(decision: string): string {
  const words = decision.replace(/[_\-\s]+/g, ' ').trim().toLowerCase();
  return words === '' ? 'Sin estado' : words.charAt(0).toUpperCase() + words.slice(1);
}

export function decisionStatus(decision: string | null): DecisionStatus {
  if (decision === null) return { label: 'Sin estado', tone: 'neutral' };
  return DECISION_STATUS[decision] ?? { label: fallbackDecisionLabel(decision), tone: 'neutral' };
}

// Texto del detalle cuando la decision final difiere de la original del
// sistema (por ejemplo PUBLISH_FAILED); null si no hay nada que aclarar.
export function originalDecisionText(decision: string | null, systemDecision: string | null): string | null {
  if (systemDecision === null || systemDecision === decision) return null;
  return `Decisión original del sistema: ${decisionStatus(systemDecision).label}`;
}

// Opciones fijas del filtro de Estado: las decisiones del contrato, en el
// mismo orden en que se declaran arriba.
export const STATUS_FILTER_OPTIONS: { value: string; label: string }[] = Object.entries(DECISION_STATUS).map(
  ([value, status]) => ({ value, label: status.label }),
);
