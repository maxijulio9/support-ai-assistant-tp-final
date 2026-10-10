import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { roleGuard } from './core/auth/role.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full',
  },
  {
    path: 'login',
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
    path: 'dashboard',
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then(
        (m) => m.DashboardComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'interactions',
    loadComponent: () =>
      import('./features/interactions/list.component').then(
        (m) => m.InteractionsListComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'users',
    loadComponent: () =>
      import('./features/users/users.component').then(
        (m) => m.UsersComponent,
      ),
    canActivate: [authGuard, roleGuard('admin')],
  },
  {
    path: 'config',
    loadChildren: () =>
      import('./features/config/config.routes').then((m) => m.CONFIG_ROUTES),
    canActivate: [authGuard, roleGuard('admin')],
  },
  {
    path: '**',
    redirectTo: 'login',
  },
];
