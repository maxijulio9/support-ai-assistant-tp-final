import { formatShortDate } from '../../shared/format-short-date';

export const RESPONDED_AT_LABEL = 'Respuesta al cliente';
export const NOT_RESPONDED_YET_TEXT = 'Todavía no se respondió al cliente';
export const RESPONDED_AT_UNKNOWN_TEXT = 'No registrada';

const PENDING_REVIEW_DECISION = 'NEEDS_REVIEW';

// Cuando se publico el primer comentario publico. Sin fecha (nota interna
// pendiente de revision, cierre sin comentario o interaccion anterior al
// registro de este dato) se explica el motivo mas probable: en una
// interaccion pendiente de revision todavia no hubo respuesta; en cualquier
// otra el dato simplemente no esta. Una fecha ilegible se trata como ausente.
export function respondedAtText(
  respondedAt: string | null | undefined,
  decision: string | null,
  now: Date = new Date(),
): string {
  const date = formatShortDate(respondedAt, now);
  if (date) return date;
  return decision === PENDING_REVIEW_DECISION ? NOT_RESPONDED_YET_TEXT : RESPONDED_AT_UNKNOWN_TEXT;
}
