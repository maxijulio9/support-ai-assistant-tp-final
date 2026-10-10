import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { inject } from '@angular/core';
import { SessionService } from './session.service';

// Chequea si hay una sesion valida (con sesion y token no vencido). Si no la
// hay, devuelve el UrlTree de redireccion a login (limpiando la sesion antes
// si el token estaba vencido). Si la sesion es valida, devuelve null para que
// el guard que la llama siga con su propia logica (por ejemplo el chequeo de
// rol en roleGuard). Usa inject(), asi que solo se puede llamar dentro de un
// contexto de inyeccion: dentro de un guard funcional, o con
// runInInjectionContext en un test.
export function redirectIfNoValidSession(): UrlTree | null {
  const sessionService = inject(SessionService);
  const router = inject(Router);

  if (!sessionService.isAuthenticated()) {
    return router.createUrlTree(['/login']);
  }

  if (sessionService.isTokenExpired()) {
    sessionService.clear();
    return router.createUrlTree(['/login']);
  }

  return null;
}

// Este guard solo mejora la experiencia de usuario evitando mostrar una
// pantalla sin sesion. La autorizacion real siempre la hace el backend en
// cada request (el interceptor ya maneja los 401 y 403 reales).
export const authGuard: CanActivateFn = () => {
  const redirect = redirectIfNoValidSession();
  return redirect ?? true;
};
