import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ApiConfiguration } from '../../api/api-configuration';
import { getMetricsSummaryApiMetricsSummaryGet } from '../../api/fn/internal-api/get-metrics-summary-api-metrics-summary-get';
import { getMetricsByCategoryApiMetricsByCategoryGet } from '../../api/fn/internal-api/get-metrics-by-category-api-metrics-by-category-get';
import { listInteractionsApiInteractionsGet } from '../../api/fn/internal-api/list-interactions-api-interactions-get';
import { MetricsSummaryResponse } from '../../api/models/metrics-summary-response';
import { CategoryMetric } from '../../api/models/category-metric';
import { InteractionListItem } from '../../api/models/interaction-list-item';

// Decision que marca una interaccion pendiente de revision humana.
// Confirmado en el backend: backend/app/modules/response_generator/schemas.py:9
const DECISION_NEEDS_REVIEW = 'NEEDS_REVIEW';

// El contrato no declara un maximo para "limit" (ver justificacion identica
// en review.service.ts y interactions.service.ts). Mismo techo de UX que la
// cola de Revision, para que el banner y el conteo real coincidan.
const PENDING_REVIEW_LIMIT = 200;

const RECENT_ACTIVITY_LIMIT = 6;

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly apiConfig = inject(ApiConfiguration);

  readonly pendingReviewLimit = PENDING_REVIEW_LIMIT;

  getSummary(fromDate: string, toDate: string): Observable<MetricsSummaryResponse> {
    return getMetricsSummaryApiMetricsSummaryGet(this.http, this.apiConfig.rootUrl, {
      from_date: fromDate,
      to_date: toDate,
    }).pipe(map((response) => response.body));
  }

  getByCategory(): Observable<CategoryMetric[]> {
    return getMetricsByCategoryApiMetricsByCategoryGet(this.http, this.apiConfig.rootUrl, {}).pipe(
      map((response) => response.body.categories),
    );
  }

  listPendingReview(): Observable<InteractionListItem[]> {
    return listInteractionsApiInteractionsGet(this.http, this.apiConfig.rootUrl, {
      decision: DECISION_NEEDS_REVIEW,
      limit: PENDING_REVIEW_LIMIT,
      offset: 0,
    }).pipe(map((response) => response.body.interactions));
  }

  listRecent(): Observable<InteractionListItem[]> {
    return listInteractionsApiInteractionsGet(this.http, this.apiConfig.rootUrl, {
      limit: RECENT_ACTIVITY_LIMIT,
      offset: 0,
    }).pipe(map((response) => response.body.interactions));
  }
}
