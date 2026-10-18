import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, map, of } from 'rxjs';
import { ApiConfiguration } from '../../api/api-configuration';
import { loginAuthLoginPost } from '../../api/fn/auth/login-auth-login-post';
import { logoutAuthLogoutPost } from '../../api/fn/auth/logout-auth-logout-post';
import { getProfileAuthProfileGet } from '../../api/fn/auth/get-profile-auth-profile-get';
import { updateProfileAuthProfilePut } from '../../api/fn/auth/update-profile-auth-profile-put';
import { forgotPasswordAuthForgotPasswordPost } from '../../api/fn/auth/forgot-password-auth-forgot-password-post';
import { resetPasswordAuthResetPasswordPost } from '../../api/fn/auth/reset-password-auth-reset-password-post';
import { UserResponse } from '../../api/models/user-response';
import { SessionService } from './session.service';
import { LOGIN_ROUTE, isLoginRoute } from './auth-routes';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly apiConfig = inject(ApiConfiguration);
  private readonly sessionService = inject(SessionService);
  private readonly router = inject(Router);

  private readonly profileSignal = signal<UserResponse | null>(null);

  // El perfil nunca se muestra si la sesion dejo de ser valida (por ejemplo
  // si el interceptor la limpio por un 401 en otra request).
  readonly profile = computed(() =>
    this.sessionService.isAuthenticated() ? this.profileSignal() : null,
  );

  login(email: string, password: string): Observable<void> {
    // se descarta el perfil anterior antes de guardar la sesion nueva
    this.profileSignal.set(null);

    return loginAuthLoginPost(this.http, this.apiConfig.rootUrl, {
      body: { email, password },
    }).pipe(
      map((response) => {
        const saved = this.sessionService.setSession(response.body.access_token, response.body.role);
        if (!saved) {
          throw new Error('La respuesta de login no trae un token o un rol validos');
        }
      }),
    );
  }

  // Nunca falla: pase lo que pase (exito, 401, red o 500) limpia la sesion
  // local, descarta el perfil y navega a login si no estamos ya ahi.
  // Es un observable frio: quien lo llama tiene que suscribirse (subscribe)
  // para que la request salga y ocurra esta limpieza.
  logout(): Observable<void> {
    return logoutAuthLogoutPost(this.http, this.apiConfig.rootUrl).pipe(
      map(() => undefined),
      catchError(() => of(undefined)),
      finalize(() => {
        this.sessionService.clear();
        this.profileSignal.set(null);
        if (!isLoginRoute(this.router.url)) {
          this.router.navigateByUrl(LOGIN_ROUTE);
        }
      }),
    );
  }

  // El backend responde 200 sin importar si el email existe (no revela
  // cuentas), asi que no hay nada que distinguir del lado del exito.
  forgotPassword(email: string): Observable<void> {
    return forgotPasswordAuthForgotPasswordPost(this.http, this.apiConfig.rootUrl, {
      body: { email },
    }).pipe(map(() => undefined));
  }

  resetPassword(token: string, newPassword: string): Observable<void> {
    return resetPasswordAuthResetPasswordPost(this.http, this.apiConfig.rootUrl, {
      body: { token, new_password: newPassword },
    }).pipe(map(() => undefined));
  }

  updateProfile(fullName: string): Observable<UserResponse> {
    // misma guarda que loadProfile: si el token cambio mientras esperaba la
    // respuesta, no pisa el perfil de la sesion nueva.
    const tokenAtRequestTime = this.sessionService.token();

    return updateProfileAuthProfilePut(this.http, this.apiConfig.rootUrl, {
      body: { full_name: fullName },
    }).pipe(
      map((response) => {
        if (this.sessionService.token() === tokenAtRequestTime) {
          this.profileSignal.set(response.body);
        }
        return response.body;
      }),
    );
  }

  loadProfile(): Observable<UserResponse> {
    // se captura el token al llamar: si cambia antes de que llegue la
    // respuesta (logout, o login de otro usuario), se descarta la respuesta
    // tardia sin guardarla, para no pisar el perfil de la sesion nueva
    const tokenAtRequestTime = this.sessionService.token();

    return getProfileAuthProfileGet(this.http, this.apiConfig.rootUrl).pipe(
      map((response) => {
        if (this.sessionService.token() === tokenAtRequestTime) {
          this.profileSignal.set(response.body);
        }
        return response.body;
      }),
    );
  }
}
