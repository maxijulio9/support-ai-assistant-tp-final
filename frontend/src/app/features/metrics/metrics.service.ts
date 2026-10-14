import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ApiConfiguration } from '../../api/api-configuration';
import { getMetricsByCategoryApiMetricsByCategoryGet } from '../../api/fn/internal-api/get-metrics-by-category-api-metrics-by-category-get';
import { CategoryMetric } from '../../api/models/category-metric';

@Injectable({ providedIn: 'root' })
export class MetricsService {
  private readonly http = inject(HttpClient);
  private readonly apiConfig = inject(ApiConfiguration);

  getByCategory(): Observable<CategoryMetric[]> {
    return getMetricsByCategoryApiMetricsByCategoryGet(this.http, this.apiConfig.rootUrl, {}).pipe(
      map((response) => response.body.categories),
    );
  }
}
