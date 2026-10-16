import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { Subject, catchError, combineLatest, map, of, startWith, switchMap, tap } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MetricsService } from '../metrics.service';
import { METRICS_TIMEZONE, defaultMetricsDayRange, resolveDateRange } from '../../dashboard/period';
import { DECISION_SEGMENTS, decisionSegmentValue, roundedSegmentPercentages } from '../decision-segments';
import { MetricsSummaryResponse } from '../../../api/models/metrics-summary-response';

export type DecisionesConfianzaState = 'loading' | 'error' | 'empty' | 'loaded';

@Component({
  selector: 'app-metrics-decisiones-confianza',
  standalone: true,
  imports: [DecimalPipe, MatButtonModule, MatIconModule, MatSlideToggleModule],
  templateUrl: './decisiones-confianza.component.html',
  styleUrl: './decisiones-confianza.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DecisionesConfianzaComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly metricsService = inject(MetricsService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly defaultRange = defaultMetricsDayRange();

  readonly state = signal<DecisionesConfianzaState>('loading');
  readonly summary = signal<MetricsSummaryResponse | null>(null);
  readonly distributionAsTable = signal(false);

  readonly totalInteractions = computed(() => this.summary()?.total_interactions ?? null);

  // --- Distribucion de decisiones ---
  // "percent" (redondeado, con el ajuste de roundedSegmentPercentages) es el
  // que se muestra como texto, para que la leyenda sume 100,0. "widthPercent"
  // (crudo, sin redondear) es el que arma el ancho visual de la barra: ahi
  // no hace falta "corregir" nada, es una proporcion continua.
  readonly decisionRows = computed(() => {
    const s = this.summary();
    if (!s) return [];

    const counts = DECISION_SEGMENTS.map((segment) => decisionSegmentValue(s, segment.key));
    const total = s.total_interactions;
    const widthPercents = counts.map((count) => (total > 0 ? (count / total) * 100 : 0));
    const percents = roundedSegmentPercentages(counts, total);

    return DECISION_SEGMENTS.map((segment, index) => ({
      value: segment.key,
      label: segment.label,
      tone: segment.tone,
      count: counts[index],
      percent: percents[index],
      widthPercent: widthPercents[index],
    }));
  });

  private readonly retry$ = new Subject<void>();

  constructor() {
    combineLatest([this.route.queryParamMap, this.retry$.pipe(startWith(undefined))])
      .pipe(
        map(([params]) => resolveDateRange(params.get('from'), params.get('to'), this.defaultRange)),
        switchMap((range) => {
          this.state.set('loading');
          return this.metricsService.getSummary(range.from, range.to, METRICS_TIMEZONE).pipe(
            tap((summary) => {
              this.summary.set(summary);
              this.state.set(summary.total_interactions === 0 ? 'empty' : 'loaded');
            }),
            catchError(() => {
              this.summary.set(null);
              this.state.set('error');
              return of(null);
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  retry(): void {
    this.retry$.next();
  }

  toggleDistributionAsTable(): void {
    this.distributionAsTable.update((value) => !value);
  }
}
