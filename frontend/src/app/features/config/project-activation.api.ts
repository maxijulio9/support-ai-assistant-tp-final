// Tipos y llamadas locales, con la misma forma que las funciones del cliente
// generado (src/app/api), que todavia no incluye estos endpoints. Se
// reemplazan por el cliente generado cuando se publique el contrato.
import { HttpClient, HttpContext, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { RequestBuilder } from '../../api/request-builder';
import { StrictHttpResponse } from '../../api/strict-http-response';

export interface ProjectActivationResponse {
  status: string;
  is_active: boolean;
  // Revisiones pendientes que quedan en el proyecto
  pending_reviews: number;
}

export interface ProjectActivationParams {
  project_key: string;
}

export function deactivateProjectApiConfigItsmProjectsProjectKeyDeactivatePost(
  http: HttpClient,
  rootUrl: string,
  params: ProjectActivationParams,
  context?: HttpContext,
): Observable<StrictHttpResponse<ProjectActivationResponse>> {
  const rb = new RequestBuilder(rootUrl, deactivateProjectApiConfigItsmProjectsProjectKeyDeactivatePost.PATH, 'post');
  rb.path('project_key', params.project_key, {});

  return http.request(rb.build({ responseType: 'json', accept: 'application/json', context })).pipe(
    filter((r: unknown): r is HttpResponse<unknown> => r instanceof HttpResponse),
    map((r) => r as StrictHttpResponse<ProjectActivationResponse>),
  );
}

deactivateProjectApiConfigItsmProjectsProjectKeyDeactivatePost.PATH = '/api/config/itsm/projects/{project_key}/deactivate';

export function activateProjectApiConfigItsmProjectsProjectKeyActivatePost(
  http: HttpClient,
  rootUrl: string,
  params: ProjectActivationParams,
  context?: HttpContext,
): Observable<StrictHttpResponse<ProjectActivationResponse>> {
  const rb = new RequestBuilder(rootUrl, activateProjectApiConfigItsmProjectsProjectKeyActivatePost.PATH, 'post');
  rb.path('project_key', params.project_key, {});

  return http.request(rb.build({ responseType: 'json', accept: 'application/json', context })).pipe(
    filter((r: unknown): r is HttpResponse<unknown> => r instanceof HttpResponse),
    map((r) => r as StrictHttpResponse<ProjectActivationResponse>),
  );
}

activateProjectApiConfigItsmProjectsProjectKeyActivatePost.PATH = '/api/config/itsm/projects/{project_key}/activate';
