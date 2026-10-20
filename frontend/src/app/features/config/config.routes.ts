import { Routes } from '@angular/router';
import { legacyTabRedirectGuard } from './config-tabs';

// Dos rutas hermanas con path '': el centro (match exacto, pathMatch
// 'full') y el shell de detalle con las secciones como hijas. Asi el shell
// se monta una sola vez para toda la navegacion entre secciones, en vez de
// un wrapper por cada una. El roleGuard('admin') de app.routes.ts ya cubre
// toda esta rama (el router evalua los guards de cada segmento del path,
// de 'config' para abajo).
export const CONFIG_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    canActivate: [legacyTabRedirectGuard],
    loadComponent: () => import('./config-center.component').then((m) => m.ConfigCenterComponent),
  },
  {
    path: '',
    loadComponent: () => import('./config-detail-shell.component').then((m) => m.ConfigDetailShellComponent),
    children: [
      {
        path: 'jsm',
        data: { sectionId: 'jsm' },
        loadComponent: () => import('./jsm-connection.component').then((m) => m.JsmConnectionComponent),
      },
      {
        path: 'proyectos',
        data: { sectionId: 'projects' },
        loadComponent: () => import('./projects-tab.component').then((m) => m.ProjectsTabComponent),
      },
      {
        path: 'campos',
        loadComponent: () =>
          import('./fields-categories-tab.component').then((m) => m.FieldsCategoriesTabComponent),
      },
      {
        path: 'confluence',
        data: { sectionId: 'confluence' },
        loadComponent: () => import('./confluence-tab.component').then((m) => m.ConfluenceTabComponent),
      },
      {
        path: 'indexacion',
        data: { sectionId: 'indexing' },
        loadComponent: () => import('./indexing-tab.component').then((m) => m.IndexingTabComponent),
      },
    ],
  },
];
