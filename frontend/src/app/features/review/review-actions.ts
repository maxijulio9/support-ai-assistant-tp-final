// Logica pura de las dos acciones nuevas de Revision (descartar y editar
// antes de aprobar). No depende del cliente generado: review.service.ts usa
// esto para armar los bodies, y review.component.ts para decidir que hacer
// con un error de discard o de aprobar con edicion.
import { ReviewErrorCategory } from './review-errors';

// Si hay issue key, se agrega al titulo del dialogo para que quede claro
// sobre que ticket se esta actuando. Si viene vacia o ausente, el titulo
// queda como estaba, sin romper.
export function dialogTitleWithIssueKey(baseTitle: string, issueKey: string | null | undefined): string {
  return issueKey ? `${baseTitle} ${issueKey}` : baseTitle;
}

export const MAX_EDITED_RESPONSE_LENGTH = 5000;

export function normalizeResponseText(value: string): string {
  return value.trim();
}

export function isEditedResponseValid(value: string): boolean {
  const normalized = normalizeResponseText(value);
  return normalized.length > 0 && normalized.length <= MAX_EDITED_RESPONSE_LENGTH;
}

// Si el texto editado (recortado) es identico al generado (recortado), se
// trata como una aprobacion comun: no se manda edited_response.
export function resolveEditedResponse(editedText: string, generatedResponse: string | null): string | null {
  const normalized = normalizeResponseText(editedText);
  const original = normalizeResponseText(generatedResponse ?? '');
  return normalized === original ? null : normalized;
}

// El revisor sale del token, nunca se manda en el body. edited_response se
// omite en vez de mandarse vacio o null cuando no hubo edicion.
export function buildApproveBody(editedResponse: string | null): { edited_response?: string } {
  return editedResponse !== null ? { edited_response: editedResponse } : {};
}

// El revisor sale del token, nunca se manda en el body.
export function buildRegenerateBody(rejectionReason: string): { rejection_reason: string } {
  return { rejection_reason: rejectionReason };
}

// El revisor sale del token en discard, nunca se manda en el body.
export function buildDiscardBody(rejectionReason: string): { rejection_reason?: string } {
  const trimmed = rejectionReason.trim();
  return trimmed ? { rejection_reason: trimmed } : {};
}

export type ReviewActionErrorOutcome = 'reopen' | 'refresh-queue';

const GENERIC_REVIEW_ACTION_ERROR_MESSAGE = 'No se pudo guardar. Intentá de nuevo.';
const UNAVAILABLE_FALLBACK_MESSAGE = 'El servicio no está disponible. Intentá de nuevo en unos minutos.';

// El 409 cubre dos casos: otra persona ya resolvio la solicitud, o la esta
// resolviendo ahora. En ese lapso puede seguir apareciendo en la cola, por
// eso el mensaje es neutro y la accion es refrescarla.
export const NOT_PENDING_MESSAGE =
  'Esta solicitud ya no está pendiente de revisión o la está resolviendo otra persona.';

export const VERIFY_IN_JIRA_MESSAGE = 'Antes de reintentar, verificá en el ticket de Jira si la respuesta ya se publicó.';

// 404 y 409: la solicitud ya no esta pendiente de revision (no existe mas,
// o otra persona ya la resolvio), no tiene sentido reabrir ningun dialogo
// con texto, hay que refrescar la cola. El resto (400, red, 503, etc.)
// reabre: perder un texto largo escrito a mano es peor que el costo de
// volver a mostrar el dialogo.
export function reviewActionErrorOutcome(category: ReviewErrorCategory): ReviewActionErrorOutcome {
  return category === 'not-found' || category === 'conflict' ? 'refresh-queue' : 'reopen';
}

// Mensaje de un 503 al aprobar (con o sin edicion): el detail del backend y,
// en una segunda linea fija, el pedido de verificar en Jira antes de
// reintentar, porque no se sabe si la respuesta llego a publicarse.
export function approveUnavailableMessage(detail: string | null): string {
  return `${detail ?? UNAVAILABLE_FALLBACK_MESSAGE}\n${VERIFY_IN_JIRA_MESSAGE}`;
}

// Mensaje a mostrar cuando el resultado es 'reopen': el detail del backend
// tal cual si es un 400 (validacion real del texto), el detail mas la linea
// de verificar en Jira si es un 503, y un mensaje generico para cualquier
// otro caso (red, error inesperado).
export function reviewActionErrorMessage(category: ReviewErrorCategory, detail: string | null): string {
  if (category === 'bad-request' && detail) return detail;
  if (category === 'unavailable') return approveUnavailableMessage(detail);
  return GENERIC_REVIEW_ACTION_ERROR_MESSAGE;
}

export type RegenerateErrorResolution =
  | { kind: 'close'; result: 'not-found' | 'not-pending' }
  | { kind: 'message'; message: string };

// Que hace el dialogo de regenerar ante un error. 404 y 409 lo cierran para
// que la pantalla refresque la cola. El resto deja el dialogo abierto con el
// motivo escrito: en un 503 se muestra solo el detail, sin la linea de
// verificar en Jira, porque regenerar no publica nada.
export function regenerateErrorResolution(
  category: ReviewErrorCategory,
  detail: string | null,
): RegenerateErrorResolution {
  switch (category) {
    case 'not-found':
      return { kind: 'close', result: 'not-found' };
    case 'conflict':
      return { kind: 'close', result: 'not-pending' };
    case 'forbidden':
      return { kind: 'message', message: 'No tenés permisos para regenerar esta respuesta.' };
    case 'validation':
      return { kind: 'message', message: 'Revisá los datos ingresados.' };
    case 'unavailable':
      return { kind: 'message', message: detail ?? UNAVAILABLE_FALLBACK_MESSAGE };
    default:
      return { kind: 'message', message: 'No se pudo regenerar la respuesta. Intentá de nuevo.' };
  }
}
