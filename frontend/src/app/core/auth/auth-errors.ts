import { HttpErrorResponse } from '@angular/common/http';
import { parseRetryAfterSeconds } from './retry-after';

export type AuthErrorCategory = 'credentials' | 'rate-limited' | 'network' | 'server' | 'request' | 'unknown';

// Clasifica un error de un endpoint de autenticacion para que la pantalla
// decida que mensaje mostrar. No distingue mas de lo que el backend ya oculta
// a proposito (login-auth-login-post.ts siempre devuelve el mismo 401
// generico, sin importar si fue el email, la password o la cuenta inactiva).
// El 429 (login y olvide mi contrasena) trae Retry-After con los segundos de
// espera; retryAfterSeconds solo tiene valor en ese caso y si el encabezado es
// un numero positivo.
export interface AuthErrorResult {
  category: AuthErrorCategory;
  retryAfterSeconds: number | null;
}

export function classifyAuthError(error: unknown): AuthErrorResult {
  const result = (category: AuthErrorCategory): AuthErrorResult => ({ category, retryAfterSeconds: null });

  if (!(error instanceof HttpErrorResponse)) {
    return result('unknown');
  }
  if (error.status === 0) {
    return result('network');
  }
  if (error.status === 401) {
    return result('credentials');
  }
  if (error.status === 429) {
    return { category: 'rate-limited', retryAfterSeconds: parseRetryAfterSeconds(error.headers?.get('Retry-After')) };
  }
  if (error.status >= 500) {
    return result('server');
  }
  if (error.status >= 400) {
    return result('request');
  }
  return result('unknown');
}
