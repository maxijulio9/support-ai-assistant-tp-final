import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ApiConfiguration } from '../../api/api-configuration';
import { getMetricsByCategoryApiMetricsByCategoryGet } from '../../api/fn/internal-api/get-metrics-by-category-api-metrics-by-category-get';
import { getMetricsSummaryApiMetricsSummaryGet } from '../../api/fn/internal-api/get-metrics-summary-api-metrics-summary-get';
import { CategoryMetric } from '../../api/models/category-metric';
import { MetricsSummaryResponse } from '../../api/models/metrics-summary-response';

@Injectable({ providedIn: 'root' })
export class MetricsService {
  private readonly http = inject(HttpClient);
  private readonly apiConfig = inject(ApiConfiguration);

  getByCategory(): Observable<CategoryMetric[]> {
    return getMetricsByCategoryApiMetricsByCategoryGet(this.http, this.apiConfig.rootUrl, {}).pipe(
      map((response) => response.body.categories),
    );
  }

  getSummary(fromDate: string, toDate: string): Observable<MetricsSummaryResponse> {
    return getMetricsSummaryApiMetricsSummaryGet(this.http, this.apiConfig.rootUrl, {
      from_date: fromDate,
      to_date: toDate,
    }).pipe(map((response) => response.body));
  }
}
