import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideEchartsCore } from 'ngx-echarts';
import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor])),
    // echarts se importa de forma perezosa (import() dinamico): el bundle
    // principal no paga el costo de la libreria para rutas que nunca
    // muestran un grafico (login, Historial, Revision, etc). Entra recien
    // cuando se instancia la directiva "echarts" (hoy, solo en el donut de
    // Inicio).
    provideEchartsCore({ echarts: () => import('echarts') }),
  ],
};
