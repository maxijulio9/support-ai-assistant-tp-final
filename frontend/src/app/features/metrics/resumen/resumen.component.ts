import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { EMPTY, Subject, catchError, combineLatest, map, merge, of, startWith, switchMap, tap } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MetricsService } from '../metrics.service';
import { defaultMetricsRange, previousPeriodOf, resolveDateRange } from '../../dashboard/period';
import { percentGrowth, ppDelta, rate, rawDelta } from '../../../shared/kpi-metrics';
import { decisionStatus, STATUS_FILTER_OPTIONS } from '../../interactions/interaction-status';
import { KpiCardComponent } from './kpi-card/kpi-card.component';
import { MetricsSummaryResponse } from '../../../api/models/metrics-summary-response';
import { CategoryMetric } from '../../../api/models/category-metric';

export type ResumenState = 'loading' | 'error' | 'empty' | 'loaded';

@Component({
  selector: 'app-metrics-resumen',
  standalone: true,
  imports: [DecimalPipe, MatButtonModule, MatIconModule, MatSlideToggleModule, KpiCardComponent],
  templateUrl: './resumen.component.html',
  styleUrl: './resumen.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResumenComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly metricsService = inject(MetricsService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly defaultRange = defaultMetricsRange();

  readonly state = signal<ResumenState>('loading');
  readonly summary = signal<MetricsSummaryResponse | null>(null);
  readonly previousSummary = signal<MetricsSummaryResponse | null>(null);
  readonly byCategory = signal<CategoryMetric[]>([]);
  readonly categoriesAsTable = signal(false);

  readonly statusOptions = STATUS_FILTER_OPTIONS;
  readonly statusFor = decisionStatus;

  // --- KPIs ---
  readonly totalInteractions = computed(() => this.summary()?.total_interactions ?? null);
  private readonly previousTotalInteractions = computed(() => this.previousSummary()?.total_interactions ?? null);
  readonly totalDeltaPercent = computed(() => percentGrowth(this.totalInteractions(), this.previousTotalInteractions()));
  readonly totalDeltaArrowUp = computed(() => (this.totalDeltaPercent() ?? 0) >= 0);

  readonly autoPublishRate = computed(() => {
    const s = this.summary();
    return s ? rate(s.auto_publish_count, s.total_interactions) : null;
  });
  private readonly previousAutoPublishRate = computed(() => {
    const s = this.previousSummary();
    return s ? rate(s.auto_publish_count, s.total_interactions) : null;
  });
  readonly autoPublishDeltaPp = computed(() => ppDelta(this.autoPublishRate(), this.previousAutoPublishRate()));
  readonly autoPublishDeltaArrowUp = computed(() => (this.autoPublishDeltaPp() ?? 0) >= 0);
  readonly autoPublishDeltaBad = computed(() => (this.autoPublishDeltaPp() ?? 0) < 0);

  readonly escalateRate = computed(() => {
    const s = this.summary();
    return s ? rate(s.escalate_count, s.total_interactions) : null;
  });
  private readonly previousEscalateRate = computed(() => {
    const s = this.previousSummary();
    return s ? rate(s.escalate_count, s.total_interactions) : null;
  });
  readonly escalateDeltaPp = computed(() => ppDelta(this.escalateRate(), this.previousEscalateRate()));
  readonly escalateDeltaArrowUp = computed(() => (this.escalateDeltaPp() ?? 0) >= 0);

  readonly avgConfidence = computed(() => this.summary()?.avg_confidence_score ?? null);
  private readonly previousAvgConfidence = computed(() => this.previousSummary()?.avg_confidence_score ?? null);
  readonly avgConfidenceDelta = computed(() => rawDelta(this.avgConfidence(), this.previousAvgConfidence()));
  readonly avgConfidenceDeltaArrowUp = computed(() => (this.avgConfidenceDelta() ?? 0) >= 0);

  // --- Solicitudes por categoria ---
  readonly categoryRows = computed(() => {
    const total = this.byCategory().reduce((sum, category) => sum + category.total_interactions, 0);
    return this.byCategory()
      .slice()
      .sort((a, b) => b.total_interactions - a.total_interactions)
      .map((category) => ({
        category: category.category,
        total: category.total_interactions,
        percent: total > 0 ? (category.total_interactions / total) * 100 : 0,
      }));
  });
  readonly leaderCategory = computed(() => this.categoryRows()[0] ?? null);

  private readonly retry$ = new Subject<void>();

  constructor() {
    combineLatest([this.route.queryParamMap, this.retry$.pipe(startWith(undefined))])
      .pipe(
        map(([params]) => resolveDateRange(params.get('from'), params.get('to'), this.defaultRange)),
        switchMap((current) => {
          this.state.set('loading');
          this.previousSummary.set(null);
          const previous = previousPeriodOf(current);

          const summary$ = this.metricsService.getSummary(current.from, current.to).pipe(
            tap((summary) => {
              this.summary.set(summary);
              this.state.set(summary.total_interactions === 0 ? 'empty' : 'loaded');
            }),
            catchError(() => {
              this.summary.set(null);
              this.state.set('error');
              return EMPTY;
            }),
          );

          // El periodo anterior es solo para el delta de cada KPI: si falla,
          // el KPI se muestra sin variacion, no bloquea el resto.
          const previousSummary$ = this.metricsService.getSummary(previous.from, previous.to).pipe(
            tap((summary) => this.previousSummary.set(summary)),
            catchError(() => {
              this.previousSummary.set(null);
              return of(null);
            }),
          );

          return merge(summary$, previousSummary$);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();

    // getByCategory no acepta rango de fechas en el contrato, asi que no
    // depende del from/to: se pide una sola vez.
    this.metricsService
      .getByCategory()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (categories) => this.byCategory.set(categories),
        error: () => this.byCategory.set([]),
      });
  }

  retry(): void {
    this.retry$.next();
  }

  toggleCategoriesAsTable(): void {
    this.categoriesAsTable.update((value) => !value);
  }
}
