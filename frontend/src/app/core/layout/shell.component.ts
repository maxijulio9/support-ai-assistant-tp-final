import { ChangeDetectionStrategy, Component, computed, inject, viewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { NgTemplateOutlet } from '@angular/common';
import { BreakpointObserver } from '@angular/cdk/layout';
import { filter, map } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ROLE_ADMIN, SessionService } from '../auth/session.service';
import { AuthService } from '../auth/auth.service';
import { roleLabel as translateRole } from '../../shared/role-label';

function initials(fullName: string | undefined): string {
  if (!fullName) return '';
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

const MAIN_NAV_ITEMS: NavItem[] = [
  { path: '/dashboard', label: 'Inicio', icon: 'dashboard' },
  { path: '/metrics', label: 'Métricas', icon: 'insights' },
  { path: '/interactions', label: 'Historial', icon: 'history' },
  { path: '/review', label: 'Revisión', icon: 'fact_check' },
];

const ADMIN_NAV_ITEMS: NavItem[] = [
  { path: '/users', label: 'Usuarios', icon: 'group' },
  { path: '/config', label: 'Configuración', icon: 'settings' },
];

// Modo cajon: pantallas chicas (menos de 768px, el .98 es la convencion
// estandar para "menor a 768px" exacto) y dispositivos sin hover, donde la
// barra de iconos no podria mostrar sus etiquetas.
const DRAWER_QUERY = '(max-width: 767.98px), (hover: none)';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    NgTemplateOutlet,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatSidenavModule,
    MatToolbarModule,
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

  private readonly drawer = viewChild(MatSidenav);

  readonly mainNavItems = MAIN_NAV_ITEMS;
  readonly adminNavItems = ADMIN_NAV_ITEMS;

  readonly isHandset = toSignal(
    this.breakpointObserver.observe(DRAWER_QUERY).pipe(map((result) => result.matches)),
    { initialValue: false },
  );

  // Esto es solo para la interfaz (mostrar u ocultar los links de admin).
  // La autorizacion real la hace el backend, y roleGuard ya protege esas rutas.
  readonly isAdmin = computed(() => this.sessionService.hasRole(ROLE_ADMIN));
  readonly profile = this.authService.profile;
  readonly initials = computed(() => initials(this.profile()?.full_name));
  readonly roleLabel = computed(() => translateRole(this.profile()?.role));

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

  toggleDrawer(): void {
    this.drawer()?.toggle();
  }

  closeDrawerIfHandset(): void {
    if (this.isHandset()) this.drawer()?.close();
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
