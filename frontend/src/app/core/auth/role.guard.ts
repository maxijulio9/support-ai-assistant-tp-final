import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { redirectIfNoValidSession } from './auth.guard';
import { SessionService } from './session.service';

// roleGuard tiene que ser seguro aunque se use solo (sin authGuard delante
// en la misma ruta), por eso reusa el mismo chequeo de sesion de auth.guard.ts.
export function roleGuard(...allowedRoles: string[]): CanActivateFn {
  return () => {
    const redirect = redirectIfNoValidSession();
    if (redirect) {
      return redirect;
    }

    const sessionService = inject(SessionService);
    const router = inject(Router);

    const hasAllowedRole = allowedRoles.some((role) => sessionService.hasRole(role));
    if (!hasAllowedRole) {
      return router.createUrlTree(['/dashboard']);
    }

    return true;
  };
}
