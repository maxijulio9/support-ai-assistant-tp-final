import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ROLE_ADMIN, SessionService } from '../auth/session.service';
import { AuthService } from '../auth/auth.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatSidenavModule,
    MatToolbarModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
  ],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShellComponent {
  private readonly sessionService = inject(SessionService);
  private readonly authService = inject(AuthService);

  // Esto es solo para la interfaz (mostrar u ocultar los links de admin).
  // La autorizacion real la hace el backend, y roleGuard ya protege esas rutas.
  readonly isAdmin = computed(() => this.sessionService.hasRole(ROLE_ADMIN));
  readonly profile = this.authService.profile;

  constructor() {
    // El error se ignora a proposito: el interceptor ya maneja un 401 (limpia
    // la sesion y redirige a login), y los demas errores no justifican
    // mostrar un mensaje en el shell, que no tiene esa responsabilidad.
    this.authService
      .loadProfile()
      .pipe(takeUntilDestroyed())
      .subscribe({ error: () => {} });
  }

  logout(): void {
    this.authService.logout().subscribe();
  }
}
