import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { SessionService } from './session.service';

// Rutas publicas de autenticacion: no llevan token ni disparan manejo de sesion.
// Un error de login con credenciales incorrectas tiene que llegar intacto al formulario.
const PUBLIC_PATHS = ['/auth/login', '/auth/forgot-password', '/auth/reset-password'];

const LOGIN_ROUTE = '/login';

// Las requests HTTP no llevan fragment (eso es solo de navegacion del browser),
// asi que para compararlas alcanza con sacar la query string.
function stripQuery(url: string): string {
  const queryIndex = url.indexOf('?');
  return queryIndex === -1 ? url : url.substring(0, queryIndex);
}

// router.url si puede traer query string y fragment, hay que sacar ambos
// para comparar contra la ruta de login.
function stripQueryAndFragment(url: string): string {
  const cutIndex = url.search(/[?#]/);
  return cutIndex === -1 ? url : url.substring(0, cutIndex);
}

function isPublicPath(url: string): boolean {
  return PUBLIC_PATHS.includes(stripQuery(url));
}

function isProtectedUrl(url: string): boolean {
  return url.startsWith('/api/') || url.startsWith('/auth/');
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (isPublicPath(req.url) || !isProtectedUrl(req.url)) {
    return next(req);
  }

  const sessionService = inject(SessionService);
  const router = inject(Router);

  const token = sessionService.token();
  const tokenAttached = token !== null;
  const authReq = tokenAttached
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authReq).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse) {
        // 401: sesion invalida siempre. 403 sin token adjunto: tambien sesion
        // invalida (el backend usa 403 cuando falta el header Authorization).
        // 403 con token adjunto: permiso denegado, no se toca la sesion.
        const isSessionInvalid = error.status === 401 || (error.status === 403 && !tokenAttached);
        if (isSessionInvalid) {
          sessionService.clear();
          if (stripQueryAndFragment(router.url) !== LOGIN_ROUTE) {
            router.navigateByUrl(LOGIN_ROUTE);
          }
        }
      }
      return throwError(() => error);
    }),
  );
};
