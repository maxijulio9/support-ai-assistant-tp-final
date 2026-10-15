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
import { decisionStatus, STATUS_FILTER_OPTIONS } from '../../interactions/interaction-status';
import { MetricsSummaryResponse } from '../../../api/models/metrics-summary-response';

export type DecisionesConfianzaState = 'loading' | 'error' | 'empty' | 'loaded';

// Campo de MetricsSummaryResponse que corresponde a cada decision, en el
// mismo orden que STATUS_FILTER_OPTIONS, para no inventar ni el orden ni las
// etiquetas. Duplicado de dashboard.component.ts (ver reporte de duplicacion).
const DECISION_COUNT_FIELD: Record<string, keyof MetricsSummaryResponse> = {
  AUTO_PUBLISH: 'auto_publish_count',
  NEEDS_REVIEW: 'needs_review_count',
  ESCALATE: 'escalate_count',
  REQUEST_INFO: 'request_info_count',
};

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
  readonly decisionRows = computed(() => {
    const s = this.summary();
    if (!s) return [];
    return STATUS_FILTER_OPTIONS.map((option) => {
      const count = (s[DECISION_COUNT_FIELD[option.value]] as number) ?? 0;
      return {
        value: option.value,
        label: option.label,
        tone: decisionStatus(option.value).tone,
        count,
        percent: s.total_interactions > 0 ? (count / s.total_interactions) * 100 : 0,
      };
    });
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
