import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ApiConfiguration } from '../../api/api-configuration';
import { listInteractionsApiInteractionsGet } from '../../api/fn/internal-api/list-interactions-api-interactions-get';
import { getInteractionDetailApiInteractionsInteractionIdGet } from '../../api/fn/internal-api/get-interaction-detail-api-interactions-interaction-id-get';
import { InteractionListItem } from '../../api/models/interaction-list-item';
import { InteractionDetailResponse } from '../../api/models/interaction-detail-response';

// El contrato no declara un maximo para "limit". Elegimos este valor como
// techo razonable de UX, no viene del contrato; el "total" de la respuesta
// dice cuantas interacciones hay en realidad.
const HISTORY_LIMIT = 200;

export interface InteractionsPage {
  items: InteractionListItem[];
  // Interacciones que cumplen los filtros, sin contar el limite
  total: number;
}

@Injectable({ providedIn: 'root' })
export class InteractionsService {
  private readonly http = inject(HttpClient);
  private readonly apiConfig = inject(ApiConfiguration);

  readonly historyLimit = HISTORY_LIMIT;

  listRecent(): Observable<InteractionsPage> {
    return listInteractionsApiInteractionsGet(this.http, this.apiConfig.rootUrl, {
      limit: HISTORY_LIMIT,
      offset: 0,
    }).pipe(map((response) => ({ items: response.body.interactions, total: response.body.total })));
  }

  // Todas las interacciones de un ticket, para completar un caso que el
  // limite de la lista pudo cortar
  listByIssue(issueKey: string): Observable<InteractionListItem[]> {
    return listInteractionsApiInteractionsGet(this.http, this.apiConfig.rootUrl, {
      issue_key: issueKey,
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
