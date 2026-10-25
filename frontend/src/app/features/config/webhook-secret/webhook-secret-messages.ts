import { HttpErrorResponse } from '@angular/common/http';
import { SecretAction } from './webhook-secret-state';

// Tiempo que el secreto queda visible, y que queda retenido oculto despues de
// regenerar, antes de descartarse de memoria.
export const SECRET_VISIBLE_MS = 30_000;

export const COPIED_MESSAGE = 'Copiado';
export const COPY_FAILED_MESSAGE = 'No se pudo copiar. Mostralo y copialo a mano.';
export const GENERATED_MESSAGE = 'Secreto generado. Pegalo en Jira y en Confluence.';
export const REGENERATED_MESSAGE = 'Secreto regenerado. Actualizalo en Jira y en Confluence ahora.';

export const NO_SECRET_TEXT = 'Todavía no hay un secreto configurado.';
export const CONNECTION_NOT_SAVED_TEXT = 'El secreto se genera al guardar la conexión.';

export const JIRA_HELP =
  'En Jira: Administración, Sistema, Webhooks. Pegalo en el campo Secret de los webhooks de creación de ticket y de comentario.';
export const CONFLUENCE_HELP =
  'En Confluence: pegalo en el encabezado X-Webhook-Secret de la acción de pedido web de la regla de Automation.';
export const CLIPBOARD_NOTE = 'Al copiarlo, el portapapeles del sistema lo conserva hasta que copies otra cosa.';

export const REGENERATE_DIALOG = {
  title: 'Regenerar el secreto',
  body:
    'Al regenerar el secreto, el anterior deja de valer enseguida. Hasta que lo actualices en Jira y en Confluence, ' +
    'esos sistemas van a recibir un 401 y sus avisos se van a rechazar. Tené a mano Jira y Confluence para actualizarlos ahora.',
  cancel: 'Cancelar',
  confirm: 'Regenerar',
};

const NETWORK_MESSAGE = 'No pudimos conectarnos con el servidor. Revisá tu conexión e intentá de nuevo.';
const UNAVAILABLE_MESSAGE = 'El servicio no está disponible. Intentá de nuevo en unos minutos.';
const FORBIDDEN_READ_MESSAGE = 'No tenés permiso para ver el secreto. Solo lo puede ver un administrador.';
const FORBIDDEN_REGENERATE_MESSAGE = 'No tenés permiso para regenerar el secreto. Solo lo puede hacer un administrador.';
const GENERIC_READ_MESSAGE = 'Ocurrió un error inesperado. Intentá de nuevo.';
const GENERIC_REGENERATE_MESSAGE = 'No se pudo regenerar el secreto. Intentá de nuevo.';
// Si no se pudo confirmar el cambio, el secreto nuevo puede haberse generado
// igual y el anterior ya no sirve.
export const UNCONFIRMED_REGENERATE_MESSAGE = 'No pudimos confirmar el cambio. Pedí el secreto con «Ver» para comprobar el actual.';
export const UNCONFIRMED_FIRST_MESSAGE = 'No pudimos confirmar si se generó el secreto. Actualizá la página para comprobarlo.';

export type WebhookSecretError = { kind: 'not-configured' } | { kind: 'error'; message: string };

// Mensaje por codigo de estado. Nunca usa el cuerpo de la respuesta: el
// secreto no tiene que terminar en un mensaje de error, y el texto del
// backend no se muestra.
export function webhookSecretError(error: unknown, action: SecretAction, hadSecret = true): WebhookSecretError {
  const isRegenerate = action === 'regenerate';
  const status = error instanceof HttpErrorResponse ? error.status : null;

  if (status === null) {
    return { kind: 'error', message: isRegenerate ? GENERIC_REGENERATE_MESSAGE : GENERIC_READ_MESSAGE };
  }

  // Solo la lectura puede responder "todavia no hay"
  if (status === 404 && !isRegenerate) return { kind: 'not-configured' };

  if (status === 403) {
    return { kind: 'error', message: isRegenerate ? FORBIDDEN_REGENERATE_MESSAGE : FORBIDDEN_READ_MESSAGE };
  }

  if (isRegenerate) {
    if (status === 0 || status >= 500) {
      return { kind: 'error', message: hadSecret ? UNCONFIRMED_REGENERATE_MESSAGE : UNCONFIRMED_FIRST_MESSAGE };
    }
    return { kind: 'error', message: GENERIC_REGENERATE_MESSAGE };
  }

  if (status === 0) return { kind: 'error', message: NETWORK_MESSAGE };
  if (status === 503) return { kind: 'error', message: UNAVAILABLE_MESSAGE };
  return { kind: 'error', message: GENERIC_READ_MESSAGE };
}
