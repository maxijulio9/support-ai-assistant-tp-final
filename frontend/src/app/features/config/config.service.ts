import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ApiConfiguration } from '../../api/api-configuration';
import { getItsmConnectionApiConfigItsmGet } from '../../api/fn/internal-api/get-itsm-connection-api-config-itsm-get';
import { configureItsmConnectionApiConfigItsmPost } from '../../api/fn/internal-api/configure-itsm-connection-api-config-itsm-post';
import { listAvailableProjectsApiConfigItsmProjectsAvailableGet } from '../../api/fn/internal-api/list-available-projects-api-config-itsm-projects-available-get';
import { listCountriesApiConfigCountriesGet } from '../../api/fn/internal-api/list-countries-api-config-countries-get';
import { onboardProjectsApiConfigItsmProjectsOnboardPost } from '../../api/fn/internal-api/onboard-projects-api-config-itsm-projects-onboard-post';
import { listOnboardedProjectsApiConfigItsmProjectsGet } from '../../api/fn/internal-api/list-onboarded-projects-api-config-itsm-projects-get';
import { configureProjectApiConfigItsmProjectsPost } from '../../api/fn/internal-api/configure-project-api-config-itsm-projects-post';
import { listProjectStatusesApiConfigItsmProjectsProjectKeyStatusesGet } from '../../api/fn/internal-api/list-project-statuses-api-config-itsm-projects-project-key-statuses-get';
import { ConnectionStatusResponse } from '../../api/models/connection-status-response';
import { ItsmConnectionRequest } from '../../api/models/itsm-connection-request';
import { ItsmConnectionResponse } from '../../api/models/itsm-connection-response';
import { AvailableProject } from '../../api/models/available-project';
import { Country } from '../../api/models/country';
import { ProjectToOnboard } from '../../api/models/project-to-onboard';
import { OnboardProjectsResponse } from '../../api/models/onboard-projects-response';
import { OnboardedProject } from '../../api/models/onboarded-project';
import { ProjectThresholds } from '../../api/models/project-thresholds';
import { ProjectConfigResponse } from '../../api/models/project-config-response';
import { JsmStatus } from '../../api/models/jsm-status';

// 3 umbrales siempre completos (sin project_id: project_key va a nivel raiz
// del request), para no depender de los defaults del backend al guardar.
export interface ProjectThresholdValues {
  threshold_auto_publish: number;
  threshold_needs_review: number;
  similarity_threshold: number;
}

// Wrapper de /api/config/* y /api/indexing/*: se va completando a medida que
// cada sub-paso de la pantalla de Configuracion lo necesita, no de una.
@Injectable({ providedIn: 'root' })
export class ConfigService {
  private readonly http = inject(HttpClient);
  private readonly apiConfig = inject(ApiConfiguration);

  getItsmConnection(): Observable<ConnectionStatusResponse> {
    return getItsmConnectionApiConfigItsmGet(this.http, this.apiConfig.rootUrl).pipe(
      map((response) => response.body),
    );
  }

  configureItsmConnection(request: ItsmConnectionRequest): Observable<ItsmConnectionResponse> {
    return configureItsmConnectionApiConfigItsmPost(this.http, this.apiConfig.rootUrl, {
      body: request,
    }).pipe(map((response) => response.body));
  }

  listAvailableProjects(): Observable<AvailableProject[]> {
    return listAvailableProjectsApiConfigItsmProjectsAvailableGet(this.http, this.apiConfig.rootUrl).pipe(
      map((response) => response.body.projects),
    );
  }

  listCountries(): Observable<Country[]> {
    return listCountriesApiConfigCountriesGet(this.http, this.apiConfig.rootUrl).pipe(
      map((response) => response.body.countries),
    );
  }

  onboardProjects(projects: ProjectToOnboard[]): Observable<OnboardProjectsResponse> {
    return onboardProjectsApiConfigItsmProjectsOnboardPost(this.http, this.apiConfig.rootUrl, {
      body: { projects },
    }).pipe(map((response) => response.body));
  }

  listOnboardedProjects(): Observable<OnboardedProject[]> {
    return listOnboardedProjectsApiConfigItsmProjectsGet(this.http, this.apiConfig.rootUrl).pipe(
      map((response) => response.body.projects),
    );
  }

  // status_mappings va siempre vacio: el backend confirmo que asi conserva
  // los mapeos ya guardados y solo escribe los umbrales. El mapeo de
  // estados todavia no se construye en esta pantalla (ver project-statuses).
  configureProjectThresholds(
    projectKey: string,
    thresholds: ProjectThresholdValues,
  ): Observable<ProjectConfigResponse> {
    return configureProjectApiConfigItsmProjectsPost(this.http, this.apiConfig.rootUrl, {
      body: { project_key: projectKey, thresholds, status_mappings: [] },
    }).pipe(map((response) => response.body));
  }

  listProjectStatuses(projectKey: string): Observable<JsmStatus[]> {
    return listProjectStatusesApiConfigItsmProjectsProjectKeyStatusesGet(this.http, this.apiConfig.rootUrl, {
      project_key: projectKey,
    }).pipe(map((response) => response.body.statuses));
  }
}
