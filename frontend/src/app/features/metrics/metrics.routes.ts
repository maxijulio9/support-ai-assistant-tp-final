import { Routes } from '@angular/router';

export const METRICS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./metrics.component').then((m) => m.MetricsComponent),
    children: [
      { path: '', redirectTo: 'resumen', pathMatch: 'full' },
      {
        path: 'resumen',
        title: 'Métricas',
        loadComponent: () => import('./resumen/resumen.component').then((m) => m.ResumenComponent),
      },
      {
        path: 'decisiones-confianza',
        title: 'Métricas',
        loadComponent: () =>
          import('./decisiones-confianza/decisiones-confianza.component').then(
            (m) => m.DecisionesConfianzaComponent,
          ),
      },
      {
        path: 'tiempos-comparativa',
        title: 'Métricas',
        loadComponent: () =>
          import('./tiempos-comparativa/tiempos-comparativa.component').then(
            (m) => m.TiemposComparativaComponent,
          ),
      },
    ],
  },
];
