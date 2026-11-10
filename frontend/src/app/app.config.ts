import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideEchartsCore } from 'ngx-echarts';
import { DateAdapter, MAT_DATE_LOCALE, provideNativeDateAdapter } from '@angular/material/core';
import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { ArgentineDateAdapter } from './shared/argentine-date-adapter';

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
    provideNativeDateAdapter(),
    // Lee las fechas escritas a mano como dia/mes/año, en Historial y Metricas
    { provide: DateAdapter, useClass: ArgentineDateAdapter },
    { provide: MAT_DATE_LOCALE, useValue: 'es' },
  ],
};
