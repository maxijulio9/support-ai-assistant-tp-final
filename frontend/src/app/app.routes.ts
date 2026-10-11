import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { roleGuard } from './core/auth/role.guard';
import { guestGuard } from './core/auth/guest.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/login/login.component').then(
        (m) => m.LoginComponent,
      ),
  },
  {
    path: 'forgot-password',
    loadComponent: () =>
      import(
        './features/auth/forgot-password/forgot-password.component'
      ).then((m) => m.ForgotPasswordComponent),
  },
  {
    path: 'reset-password',
    loadComponent: () =>
      import(
        './features/auth/reset-password/reset-password.component'
      ).then((m) => m.ResetPasswordComponent),
  },
  {
    path: '',
    loadComponent: () =>
      import('./core/layout/shell.component').then((m) => m.ShellComponent),
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        title: 'Inicio',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent,
          ),
      },
      {
        path: 'interactions',
        title: 'Historial',
        loadComponent: () =>
          import('./features/interactions/list.component').then(
            (m) => m.InteractionsListComponent,
          ),
      },
      {
        path: 'review',
        title: 'Revisión',
        loadComponent: () =>
          import('./features/review/review.component').then(
            (m) => m.ReviewComponent,
          ),
      },
      {
        path: 'users',
        title: 'Usuarios',
        loadComponent: () =>
          import('./features/users/users.component').then(
            (m) => m.UsersComponent,
          ),
        canActivate: [roleGuard('admin')],
      },
      {
        path: 'config',
        title: 'Configuración',
        loadChildren: () =>
          import('./features/config/config.routes').then(
            (m) => m.CONFIG_ROUTES,
          ),
        canActivate: [roleGuard('admin')],
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'dashboard',
  },
];
