import { formatShortDate } from '../../shared/format-short-date';

const GENERATED_AT_LABEL = 'Respuesta sugerida generada';
export const NOT_RECORDED_TEXT = 'No registrada';
export const REVIEW_NOT_RECORDED_TEXT = 'Revisión no registrada';
export const NO_HUMAN_REVIEW_TEXT = 'Sin revisión humana';

// Canales de resolucion que solo produce una persona desde Revision
const HUMAN_CHANNELS: ReadonlySet<string> = new Set([
  'REVIEWED_APPROVED',
  'REVIEWED_EDITED',
  'REVIEWED_REGENERATED',
  'ESCALATED_BY_HUMAN',
  'DISCARDED_BY_HUMAN',
]);
const AUTO_CHANNEL = 'AUTO';
// Una descartada siempre es manual, aunque el canal no venga
const DISCARDED_DECISION = 'DISCARDED';

// Cuando el modelo genero la respuesta, en fecha corta. Sin dato o con una
// fecha ilegible: "Respuesta sugerida generada: No registrada"
export function generatedAtText(value: string | null | undefined, now: Date = new Date()): string {
  const date = formatShortDate(value, now);
  return date ? `${GENERATED_AT_LABEL} el ${date}` : `${GENERATED_AT_LABEL}: ${NOT_RECORDED_TEXT}`;
}

export interface ReviewInfoInput {
  decision: string | null;
  resolution_channel: string | null;
  reviewed_at: string | null | undefined;
  reviewed_by_name: string | null | undefined;
}

// La resolvio una persona segun los datos que ya hay: canal de resolucion
// manual o decision descartada
export function isHumanResolved(input: Pick<ReviewInfoInput, 'decision' | 'resolution_channel'>): boolean {
  return (
    (input.resolution_channel !== null && HUMAN_CHANNELS.has(input.resolution_channel)) ||
    input.decision === DISCARDED_DECISION
  );
}

// Linea de revision del detalle del Historial; null si no corresponde mostrarla
// (pendiente, resuelta por fuera, cierre del cliente o sin datos).
// Con fecha valida se muestra siempre, con o sin nombre. Sin fecha, una
// resolucion manual es anterior a este dato; una publicacion automatica no
// tuvo revision humana.
export function reviewText(input: ReviewInfoInput, now: Date = new Date()): string | null {
  const date = formatShortDate(input.reviewed_at, now);
  const name = input.reviewed_by_name?.trim() ?? '';
  if (date) return name ? `Revisada el ${date} por ${name}` : `Revisada el ${date}`;
  if (isHumanResolved(input)) return REVIEW_NOT_RECORDED_TEXT;
  if (input.resolution_channel === AUTO_CHANNEL && input.decision !== 'RESOLVED') return NO_HUMAN_REVIEW_TEXT;
  return null;
}
