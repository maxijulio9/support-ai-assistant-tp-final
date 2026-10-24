import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, throwError, timer } from 'rxjs';
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
import { MetricsFilters } from './metrics-filters';
import { ResponseTimesUnavailableError } from './tiempos-comparativa/response-times-error';
import { ResponseTimesFilters } from './tiempos-comparativa/response-times-filters';
import { ResponseTimesLike } from './tiempos-comparativa/response-times.types';
import { responseTimesFixture } from './tiempos-comparativa/response-times.fixture';

@Injectable({ providedIn: 'root' })
export class MetricsService {
  private readonly http = inject(HttpClient);
  private readonly apiConfig = inject(ApiConfiguration);

  getByCategory(tz: string, fromDate?: string, toDate?: string, filters?: MetricsFilters): Observable<CategoryMetric[]> {
    return getMetricsByCategoryApiMetricsByCategoryGet(this.http, this.apiConfig.rootUrl, {
      tz,
      from_date: fromDate,
      to_date: toDate,
      category: filters?.category ?? undefined,
      decision: filters?.decision ?? undefined,
    }).pipe(map((response) => response.body.categories));
  }

  getSummary(fromDate: string, toDate: string, tz: string, filters?: MetricsFilters): Observable<MetricsSummaryResponse> {
    return getMetricsSummaryApiMetricsSummaryGet(this.http, this.apiConfig.rootUrl, {
      from_date: fromDate,
      to_date: toDate,
      tz,
      category: filters?.category ?? undefined,
      decision: filters?.decision ?? undefined,
    }).pipe(map((response) => response.body));
  }

  getDaily(fromDate: string, toDate: string, tz: string, filters?: MetricsFilters): Observable<DailyMetric[]> {
    return getMetricsDailyApiMetricsDailyGet(this.http, this.apiConfig.rootUrl, {
      from_date: fromDate,
      to_date: toDate,
      tz,
      category: filters?.category ?? undefined,
      decision: filters?.decision ?? undefined,
    }).pipe(map((response) => response.body.days));
  }

  getHeatmap(fromDate: string, toDate: string, tz: string, filters?: MetricsFilters): Observable<HeatmapCell[]> {
    return getMetricsHeatmapApiMetricsHeatmapGet(this.http, this.apiConfig.rootUrl, {
      from_date: fromDate,
      to_date: toDate,
      tz,
      category: filters?.category ?? undefined,
      decision: filters?.decision ?? undefined,
    }).pipe(map((response) => response.body.cells));
  }

  getConfidenceDistribution(
    fromDate: string,
    toDate: string,
    tz: string,
    filters?: MetricsFilters,
  ): Observable<ConfidenceDistributionResponse> {
    return getMetricsConfidenceDistributionApiMetricsConfidenceDistributionGet(this.http, this.apiConfig.rootUrl, {
      from_date: fromDate,
      to_date: toDate,
      tz,
      category: filters?.category ?? undefined,
      decision: filters?.decision ?? undefined,
    }).pipe(map((response) => response.body));
  }

  // Nunca manda project_id: siempre pide los umbrales de todos los proyectos
  // configurados. No acepta category ni decision, el contrato no los define
  // para este endpoint.
  getThresholds(): Observable<ProjectThresholdsItem[]> {
    return getMetricsThresholdsApiMetricsThresholdsGet(this.http, this.apiConfig.rootUrl, {}).pipe(
      map((response) => response.body.projects),
    );
  }

  // Tiempos de respuesta por cohorte. Sin funcion generada para este endpoint
  // todavia no se escribe la llamada a mano: falla con un error local hasta
  // que el cliente la incluya. No acepta decision, el contrato no la define.
  getResponseTimes(
    _fromDate: string,
    _toDate: string,
    _tz: string,
    _filters?: ResponseTimesFilters,
  ): Observable<ResponseTimesLike> {
    return timer(300).pipe(map(() => responseTimesFixture(_filters)));
  }
}
