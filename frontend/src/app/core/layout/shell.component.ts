import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { BreakpointObserver } from '@angular/cdk/layout';
import { filter, map } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ROLE_ADMIN, SessionService } from '../auth/session.service';
import { AuthService } from '../auth/auth.service';

// Traduccion del rol para mostrar en la interfaz. Un rol desconocido se
// muestra tal cual (no rompe, no inventa una traduccion).
const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  agent: 'Agente',
};

function roleLabel(role: string | undefined): string {
  if (!role) return '';
  return ROLE_LABELS[role] ?? role;
}

function initials(fullName: string | undefined): string {
  if (!fullName) return '';
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

// Breakpoint de pantalla chica: por debajo de 768px el nav pasa a cajon.
// El .98 es la convencion estandar para "menor a 768px" exacto.
const HANDSET_QUERY = '(max-width: 767.98px)';

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
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly breakpointObserver = inject(BreakpointObserver);

  readonly isHandset = toSignal(
    this.breakpointObserver.observe(HANDSET_QUERY).pipe(map((result) => result.matches)),
    { initialValue: false },
  );

  // Esto es solo para la interfaz (mostrar u ocultar los links de admin).
  // La autorizacion real la hace el backend, y roleGuard ya protege esas rutas.
  readonly isAdmin = computed(() => this.sessionService.hasRole(ROLE_ADMIN));
  readonly profile = this.authService.profile;
  readonly initials = computed(() => initials(this.profile()?.full_name));
  readonly roleLabel = computed(() => roleLabel(this.profile()?.role));

  // Se lee de la propiedad "title" de la ruta activa mas profunda (no de
  // data.title). Si la ruta no define title, el breadcrumb no se renderiza.
  // No se agrega un TitleStrategy propio, esto solo lee el snapshot.
  readonly breadcrumbTitle = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(() => this.deepestRouteTitle()),
    ),
    { initialValue: this.deepestRouteTitle() },
  );

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

  private deepestRouteTitle(): string | undefined {
    let route = this.activatedRoute.snapshot;
    while (route.firstChild) {
      route = route.firstChild;
    }
    return route.title;
  }
}
