import { HttpErrorResponse } from '@angular/common/http';

export type ReviewErrorCategory =
  | 'not-found'
  | 'forbidden'
  | 'bad-request'
  | 'validation'
  | 'conflict'
  | 'unavailable'
  | 'network'
  | 'server'
  | 'unknown';

// No se reutiliza classifyAuthError (core/auth/auth-errors.ts): esa funcion
// se penso para la pantalla de login y agrupa 403, 404 y 422 en una sola
// categoria generica ('request'). Revision necesita distinguirlos (cada uno
// tiene un mensaje y una accion distinta), asi que lee el status directo.
// 'bad-request' (400) es distinto de 'validation' (422): el 400 trae un
// detail legible pensado para mostrar tal cual (editar y aprobar), el 422
// no deberia ocurrir si el formulario valida bien y usa un mensaje generico.
// 'unavailable' (503) se separa del resto de los 5xx: el backend manda un
// detail legible y, a diferencia de un 500, no implica que haya que dudar
// del estado de la solicitud de la misma manera.
export function classifyReviewError(error: unknown): ReviewErrorCategory {
  if (!(error instanceof HttpErrorResponse)) {
    return 'unknown';
  }
  if (error.status === 404) return 'not-found';
  if (error.status === 403) return 'forbidden';
  if (error.status === 400) return 'bad-request';
  if (error.status === 409) return 'conflict';
  if (error.status === 422) return 'validation';
  if (error.status === 0) return 'network';
  if (error.status === 503) return 'unavailable';
  if (error.status >= 500) return 'server';
  return 'unknown';
}

// Texto legible que el backend manda en el body de un error (detail), si
// lo trae. null si no es un HttpErrorResponse o no viene ese campo.
export function reviewErrorDetail(error: unknown): string | null {
  if (!(error instanceof HttpErrorResponse)) return null;
  return typeof error.error?.detail === 'string' ? error.error.detail : null;
}
