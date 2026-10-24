import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ApiConfiguration } from '../../api/api-configuration';
import { listInteractionsApiInteractionsGet } from '../../api/fn/internal-api/list-interactions-api-interactions-get';
import { getInteractionDetailApiInteractionsInteractionIdGet } from '../../api/fn/internal-api/get-interaction-detail-api-interactions-interaction-id-get';
import { approveInteractionApiInteractionsInteractionIdApprovePost } from '../../api/fn/internal-api/approve-interaction-api-interactions-interaction-id-approve-post';
import { regenerateInteractionApiInteractionsInteractionIdRegeneratePost } from '../../api/fn/internal-api/regenerate-interaction-api-interactions-interaction-id-regenerate-post';
import { discardInteractionApiInteractionsInteractionIdDiscardPost } from '../../api/fn/internal-api/discard-interaction-api-interactions-interaction-id-discard-post';
import { buildApproveBody, buildDiscardBody, buildRegenerateBody } from './review-actions';
import { InteractionListItem } from '../../api/models/interaction-list-item';
import { InteractionDetailResponse } from '../../api/models/interaction-detail-response';
import { InteractionReviewResponse } from '../../api/models/interaction-review-response';

// Decision que marca una interaccion pendiente de revision humana.
// Confirmado en el backend: backend/app/modules/response_generator/schemas.py:9
const DECISION_NEEDS_REVIEW = 'NEEDS_REVIEW';

// El contrato no declara un maximo para "limit" (ni el schema ni el backend:
// backend/app/modules/internal_api/router.py:349 y
// backend/app/modules/internal_api/repositories/interaction_listing_repository.py:57
// pasan el valor directo al SQL sin ningun tope). Elegimos este valor como
// techo razonable de UX, no viene del contrato.
const QUEUE_LIMIT = 200;

@Injectable({ providedIn: 'root' })
export class ReviewService {
  private readonly http = inject(HttpClient);
  private readonly apiConfig = inject(ApiConfiguration);

  readonly queueLimit = QUEUE_LIMIT;

  listPending(): Observable<InteractionListItem[]> {
    return listInteractionsApiInteractionsGet(this.http, this.apiConfig.rootUrl, {
      decision: DECISION_NEEDS_REVIEW,
      limit: QUEUE_LIMIT,
      offset: 0,
    }).pipe(map((response) => response.body.interactions));
  }

  getDetail(interactionId: string): Observable<InteractionDetailResponse> {
    return getInteractionDetailApiInteractionsInteractionIdGet(this.http, this.apiConfig.rootUrl, {
      interaction_id: interactionId,
    }).pipe(map((response) => response.body));
  }

  // El backend publica generated_response tal cual esta (ApproveRequest no
  // tiene ningun campo de texto), asi que aprobar siempre manda el original.
  // editedResponse llega null cuando el dialogo de edicion ya resolvio que
  // el texto es identico al generado (resolveEditedResponse en
  // review-actions.ts): en ese caso se omite, y el backend lo trata como
  // una aprobacion comun.
  approve(interactionId: string, editedResponse?: string | null): Observable<InteractionReviewResponse> {
    return approveInteractionApiInteractionsInteractionIdApprovePost(this.http, this.apiConfig.rootUrl, {
      interaction_id: interactionId,
      body: buildApproveBody(editedResponse ?? null),
    }).pipe(map((response) => response.body));
  }

  // El revisor sale del token en aprobar, descartar y regenerar, nunca se
  // manda en el body.
  discard(interactionId: string, rejectionReason: string | undefined): Observable<InteractionReviewResponse> {
    return discardInteractionApiInteractionsInteractionIdDiscardPost(this.http, this.apiConfig.rootUrl, {
      interaction_id: interactionId,
      body: buildDiscardBody(rejectionReason ?? ''),
    }).pipe(map((response) => response.body));
  }

  regenerate(interactionId: string, rejectionReason: string): Observable<InteractionReviewResponse> {
    return regenerateInteractionApiInteractionsInteractionIdRegeneratePost(this.http, this.apiConfig.rootUrl, {
      interaction_id: interactionId,
      body: buildRegenerateBody(rejectionReason),
    }).pipe(map((response) => response.body));
  }
}
