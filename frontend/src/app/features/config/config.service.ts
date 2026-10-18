import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ApiConfiguration } from '../../api/api-configuration';
import { getItsmConnectionApiConfigItsmGet } from '../../api/fn/internal-api/get-itsm-connection-api-config-itsm-get';
import { configureItsmConnectionApiConfigItsmPost } from '../../api/fn/internal-api/configure-itsm-connection-api-config-itsm-post';
import { ConnectionStatusResponse } from '../../api/models/connection-status-response';
import { ItsmConnectionRequest } from '../../api/models/itsm-connection-request';
import { ItsmConnectionResponse } from '../../api/models/itsm-connection-response';

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
}
