import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ApiConfiguration } from '../../api/api-configuration';
import { listInteractionsApiInteractionsGet } from '../../api/fn/internal-api/list-interactions-api-interactions-get';
import { getInteractionDetailApiInteractionsInteractionIdGet } from '../../api/fn/internal-api/get-interaction-detail-api-interactions-interaction-id-get';
import { InteractionListItem } from '../../api/models/interaction-list-item';
import { InteractionDetailResponse } from '../../api/models/interaction-detail-response';

// El contrato no declara un maximo para "limit" ni un "total" en la respuesta
// (backend/app/modules/internal_api/router.py:349 y
// backend/app/modules/internal_api/repositories/interaction_listing_repository.py:18-19
// pasan el valor directo al SQL, sin tope ni conteo). Elegimos este valor
// como techo razonable de UX, no viene del contrato.
const HISTORY_LIMIT = 200;

@Injectable({ providedIn: 'root' })
export class InteractionsService {
  private readonly http = inject(HttpClient);
  private readonly apiConfig = inject(ApiConfiguration);

  readonly historyLimit = HISTORY_LIMIT;

  listRecent(): Observable<InteractionListItem[]> {
    return listInteractionsApiInteractionsGet(this.http, this.apiConfig.rootUrl, {
      limit: HISTORY_LIMIT,
      offset: 0,
    }).pipe(map((response) => response.body.interactions));
  }

  getDetail(interactionId: string): Observable<InteractionDetailResponse> {
    return getInteractionDetailApiInteractionsInteractionIdGet(this.http, this.apiConfig.rootUrl, {
      interaction_id: interactionId,
    }).pipe(map((response) => response.body));
  }
}
