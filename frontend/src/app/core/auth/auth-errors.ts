import { HttpErrorResponse } from '@angular/common/http';

export type AuthErrorCategory = 'credentials' | 'network' | 'server' | 'request' | 'unknown';

// Clasifica un error de un endpoint de autenticacion para que la pantalla
// decida que mensaje mostrar. No distingue mas de lo que el backend ya oculta
// a proposito (login-auth-login-post.ts siempre devuelve el mismo 401
// generico, sin importar si fue el email, la password o la cuenta inactiva).
export function classifyAuthError(error: unknown): AuthErrorCategory {
  if (!(error instanceof HttpErrorResponse)) {
    return 'unknown';
  }
  if (error.status === 0) {
    return 'network';
  }
  if (error.status === 401) {
    return 'credentials';
  }
  if (error.status >= 500) {
    return 'server';
  }
  if (error.status >= 400) {
    return 'request';
  }
  return 'unknown';
}
