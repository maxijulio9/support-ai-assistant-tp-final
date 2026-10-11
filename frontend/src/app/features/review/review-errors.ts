import { HttpErrorResponse } from '@angular/common/http';

export type ReviewErrorCategory = 'not-found' | 'forbidden' | 'validation' | 'network' | 'server' | 'unknown';

// No se reutiliza classifyAuthError (core/auth/auth-errors.ts): esa funcion
// se penso para la pantalla de login y agrupa 403, 404 y 422 en una sola
// categoria generica ('request'). Revision necesita distinguirlos (cada uno
// tiene un mensaje y una accion distinta), asi que lee el status directo.
export function classifyReviewError(error: unknown): ReviewErrorCategory {
  if (!(error instanceof HttpErrorResponse)) {
    return 'unknown';
  }
  if (error.status === 404) return 'not-found';
  if (error.status === 403) return 'forbidden';
  if (error.status === 422) return 'validation';
  if (error.status === 0) return 'network';
  if (error.status >= 500) return 'server';
  return 'unknown';
}
