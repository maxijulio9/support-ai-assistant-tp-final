import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { SessionService } from './session.service';

// Guarda la ruta de login para que un usuario con sesion valida no vea el
// formulario de nuevo. No se usa en forgot-password ni reset-password: el
// link del mail tiene que funcionar aunque haya una sesion abierta.
export const guestGuard: CanActivateFn = () => {
  const sessionService = inject(SessionService);
  const router = inject(Router);

  if (!sessionService.isAuthenticated()) {
    return true;
  }

  if (sessionService.isTokenExpired()) {
    sessionService.clear();
    return true;
  }

  return router.createUrlTree(['/dashboard']);
};
