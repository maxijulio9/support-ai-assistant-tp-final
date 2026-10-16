import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ApiConfiguration } from '../../api/api-configuration';
import { getMetricsByCategoryApiMetricsByCategoryGet } from '../../api/fn/internal-api/get-metrics-by-category-api-metrics-by-category-get';
import { getMetricsConfidenceDistributionApiMetricsConfidenceDistributionGet } from '../../api/fn/internal-api/get-metrics-confidence-distribution-api-metrics-confidence-distribution-get';
import { getMetricsDailyApiMetricsDailyGet } from '../../api/fn/internal-api/get-metrics-daily-api-metrics-daily-get';
import { getMetricsHeatmapApiMetricsHeatmapGet } from '../../api/fn/internal-api/get-metrics-heatmap-api-metrics-heatmap-get';
import { getMetricsSummaryApiMetricsSummaryGet } from '../../api/fn/internal-api/get-metrics-summary-api-metrics-summary-get';
import { getMetricsThresholdsApiMetricsThresholdsGet } from '../../api/fn/internal-api/get-metrics-thresholds-api-metrics-thresholds-get';
import { CategoryMetric } from '../../api/models/category-metric';
import { ConfidenceDistributionResponse } from '../../api/models/confidence-distribution-response';
import { DailyMetric } from '../../api/models/daily-metric';
import { HeatmapCell } from '../../api/models/heatmap-cell';
import { MetricsSummaryResponse } from '../../api/models/metrics-summary-response';
import { ProjectThresholdsItem } from '../../api/models/project-thresholds-item';

@Injectable({ providedIn: 'root' })
export class MetricsService {
  private readonly http = inject(HttpClient);
  private readonly apiConfig = inject(ApiConfiguration);

  getByCategory(tz: string, fromDate?: string, toDate?: string): Observable<CategoryMetric[]> {
    return getMetricsByCategoryApiMetricsByCategoryGet(this.http, this.apiConfig.rootUrl, {
      tz,
      from_date: fromDate,
      to_date: toDate,
    }).pipe(map((response) => response.body.categories));
  }

  getSummary(fromDate: string, toDate: string, tz: string): Observable<MetricsSummaryResponse> {
    return getMetricsSummaryApiMetricsSummaryGet(this.http, this.apiConfig.rootUrl, {
      from_date: fromDate,
      to_date: toDate,
      tz,
    }).pipe(map((response) => response.body));
  }

  getDaily(fromDate: string, toDate: string, tz: string): Observable<DailyMetric[]> {
    return getMetricsDailyApiMetricsDailyGet(this.http, this.apiConfig.rootUrl, {
      from_date: fromDate,
      to_date: toDate,
      tz,
    }).pipe(map((response) => response.body.days));
  }

  getHeatmap(fromDate: string, toDate: string, tz: string): Observable<HeatmapCell[]> {
    return getMetricsHeatmapApiMetricsHeatmapGet(this.http, this.apiConfig.rootUrl, {
      from_date: fromDate,
      to_date: toDate,
      tz,
    }).pipe(map((response) => response.body.cells));
  }

  getConfidenceDistribution(fromDate: string, toDate: string, tz: string): Observable<ConfidenceDistributionResponse> {
    return getMetricsConfidenceDistributionApiMetricsConfidenceDistributionGet(this.http, this.apiConfig.rootUrl, {
      from_date: fromDate,
      to_date: toDate,
      tz,
    }).pipe(map((response) => response.body));
  }

  // Nunca manda project_id: siempre pide los umbrales de todos los proyectos
  // configurados.
  getThresholds(): Observable<ProjectThresholdsItem[]> {
    return getMetricsThresholdsApiMetricsThresholdsGet(this.http, this.apiConfig.rootUrl, {}).pipe(
      map((response) => response.body.projects),
    );
  }
}
