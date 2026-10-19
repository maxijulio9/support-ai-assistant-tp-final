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
import { listSelectFieldsApiConfigItsmFieldsGet } from '../../api/fn/internal-api/list-select-fields-api-config-itsm-fields-get';
import { listFieldOptionsApiConfigItsmFieldsFieldIdOptionsGet } from '../../api/fn/internal-api/list-field-options-api-config-itsm-fields-field-id-options-get';
import { configureCategoriesApiConfigItsmProjectsProjectKeyCategoriesPost } from '../../api/fn/internal-api/configure-categories-api-config-itsm-projects-project-key-categories-post';
import { getProjectConfigurationApiConfigItsmProjectsProjectKeyGet } from '../../api/fn/internal-api/get-project-configuration-api-config-itsm-projects-project-key-get';
import { getProjectRequestTypesApiConfigItsmProjectsProjectKeyRequestTypesGet } from '../../api/fn/internal-api/get-project-request-types-api-config-itsm-projects-project-key-request-types-get';
import { configureRequestTypesApiConfigItsmProjectsProjectKeyRequestTypesPost } from '../../api/fn/internal-api/configure-request-types-api-config-itsm-projects-project-key-request-types-post';
import { listPrioritiesApiConfigItsmProjectsProjectKeyPrioritiesGet } from '../../api/fn/internal-api/list-priorities-api-config-itsm-projects-project-key-priorities-get';
import { configurePriorityMappingApiConfigItsmProjectsProjectKeyPrioritiesPost } from '../../api/fn/internal-api/configure-priority-mapping-api-config-itsm-projects-project-key-priorities-post';
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
import { JsmField } from '../../api/models/jsm-field';
import { ProjectConfigurationResponse } from '../../api/models/project-configuration-response';
import { ProjectRequestType } from '../../api/models/project-request-type';
import { JsmPriority } from '../../api/models/jsm-priority';

// Nivel universal de prioridad como clave, lista de ids reales de JSM como
// valor: misma forma que usan tanto el POST como el detalle del proyecto.
export type PriorityMapping = Record<string, string[]>;

export interface PrioritiesWithSuggestion {
  priorities: JsmPriority[];
  suggestions: Record<string, string | null>;
}

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

  listSelectFields(): Observable<JsmField[]> {
    return listSelectFieldsApiConfigItsmFieldsGet(this.http, this.apiConfig.rootUrl).pipe(
      map((response) => response.body.fields),
    );
  }

  listFieldOptions(fieldId: string): Observable<string[]> {
    return listFieldOptionsApiConfigItsmFieldsFieldIdOptionsGet(this.http, this.apiConfig.rootUrl, {
      field_id: fieldId,
    }).pipe(map((response) => response.body.options));
  }

  // El backend solo agrega: lo ya vinculado se conserva aunque no venga en
  // la lista, y no hay forma de desactivar ni quitar categorias por API
  // (limitacion conocida, registrada como tarea pendiente del backend).
  configureCategories(projectKey: string, categories: string[]) {
    return configureCategoriesApiConfigItsmProjectsProjectKeyCategoriesPost(this.http, this.apiConfig.rootUrl, {
      project_key: projectKey,
      body: { categories },
    }).pipe(map((response) => response.body));
  }

  getProjectConfiguration(projectKey: string): Observable<ProjectConfigurationResponse> {
    return getProjectConfigurationApiConfigItsmProjectsProjectKeyGet(this.http, this.apiConfig.rootUrl, {
      project_key: projectKey,
    }).pipe(map((response) => response.body));
  }

  listProjectRequestTypes(projectKey: string): Observable<ProjectRequestType[]> {
    return getProjectRequestTypesApiConfigItsmProjectsProjectKeyRequestTypesGet(this.http, this.apiConfig.rootUrl, {
      project_key: projectKey,
    }).pipe(map((response) => response.body.request_types));
  }

  // Sin body: incorpora todos los tipos de solicitud del proyecto en JSM.
  configureRequestTypes(projectKey: string) {
    return configureRequestTypesApiConfigItsmProjectsProjectKeyRequestTypesPost(this.http, this.apiConfig.rootUrl, {
      project_key: projectKey,
    }).pipe(map((response) => response.body));
  }

  listProjectPriorities(projectKey: string): Observable<PrioritiesWithSuggestion> {
    return listPrioritiesApiConfigItsmProjectsProjectKeyPrioritiesGet(this.http, this.apiConfig.rootUrl, {
      project_key: projectKey,
    }).pipe(map((response) => response.body));
  }

  // El backend solo agrega: un id ya asignado a un nivel no se puede quitar
  // ni mover a otro nivel por API (mismo tipo de limitacion que categorias).
  configurePriorityMapping(projectKey: string, mapping: PriorityMapping) {
    return configurePriorityMappingApiConfigItsmProjectsProjectKeyPrioritiesPost(this.http, this.apiConfig.rootUrl, {
      project_key: projectKey,
      body: { mapping },
    }).pipe(map((response) => response.body));
  }
}
