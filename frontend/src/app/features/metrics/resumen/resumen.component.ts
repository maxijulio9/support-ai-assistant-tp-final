import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { EMPTY, Subject, catchError, combineLatest, map, merge, of, startWith, switchMap, tap } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { NgxEchartsDirective } from 'ngx-echarts';
import type { EChartsCoreOption } from 'echarts/core';
import { MetricsService } from '../metrics.service';
import {
  METRICS_TIMEZONE,
  defaultMetricsDayRange,
  parseIsoDateLocal,
  previousCalendarDayRange,
  resolveDateRange,
} from '../../dashboard/period';
import { percentGrowth, ppDelta, rate, rawDelta } from '../../../shared/kpi-metrics';
import { DecisionTone, decisionStatus, STATUS_FILTER_OPTIONS } from '../../interactions/interaction-status';
import { KpiCardComponent } from './kpi-card/kpi-card.component';
import { MetricsSummaryResponse } from '../../../api/models/metrics-summary-response';
import { CategoryMetric } from '../../../api/models/category-metric';
import { DailyMetric } from '../../../api/models/daily-metric';

export type ResumenState = 'loading' | 'error' | 'empty' | 'loaded';
export type DailyState = 'loading' | 'error' | 'loaded';

type DailySegmentTone = DecisionTone | 'resolved';

interface DailySegment {
  key: string;
  label: string;
  tone: DailySegmentTone;
}

// Las 4 decisiones de siempre, mismo orden y color que la barra de
// Decisiones y confianza, mas un quinto segmento local que agrupa las dos
// decisiones que decisionStatus no cubre (resolved_count y
// resolved_externally_count no son parte de las 4 decisiones mapeadas).
const DAILY_SEGMENTS: DailySegment[] = [
  ...STATUS_FILTER_OPTIONS.map((option) => ({
    key: option.value,
    label: option.label,
    tone: decisionStatus(option.value).tone as DailySegmentTone,
  })),
  { key: 'RESOLVED_GROUP', label: 'Resueltas (incluye externas)', tone: 'resolved' },
];

// Campo de DailyMetric para cada una de las 4 decisiones mapeadas, mismo
// orden que STATUS_FILTER_OPTIONS. Duplicado de dashboard.component.ts y
// decisiones-confianza.component.ts (ver reporte de duplicacion).
const DAILY_COUNT_FIELD: Record<string, keyof DailyMetric> = {
  AUTO_PUBLISH: 'auto_publish_count',
  NEEDS_REVIEW: 'needs_review_count',
  ESCALATE: 'escalate_count',
  REQUEST_INFO: 'request_info_count',
};

function dailySegmentValue(day: DailyMetric, key: string): number {
  if (key === 'RESOLVED_GROUP') return day.resolved_count + day.resolved_externally_count;
  return (day[DAILY_COUNT_FIELD[key]] as number) ?? 0;
}

// El canvas de echarts no puede resolver var(--token) solo, hace falta el
// color literal, leido en runtime (mismo patron que decisions-donut).
const DAILY_SEGMENT_CSS_VAR: Record<DailySegmentTone, string> = {
  success: '--app-color-success',
  warning: '--app-color-warning',
  error: '--mat-sys-error',
  neutral: '--app-color-text-secondary',
  resolved: '--mat-sys-tertiary',
};

function resolveDailySegmentColor(tone: DailySegmentTone): string {
  return getComputedStyle(document.documentElement).getPropertyValue(DAILY_SEGMENT_CSS_VAR[tone]).trim();
}

const SHORT_DAY_FORMATTER = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' });

// No reusa formatShortDate (shared/): esa incluye hora y minuto, pensada
// para timestamps, y aca "date" es un dia AAAA-MM-DD sin hora.
function formatShortDay(day: string): string {
  return SHORT_DAY_FORMATTER.format(parseIsoDateLocal(day));
}

@Component({
  selector: 'app-metrics-resumen',
  standalone: true,
  imports: [DecimalPipe, MatButtonModule, MatIconModule, MatSlideToggleModule, NgxEchartsDirective, KpiCardComponent],
  templateUrl: './resumen.component.html',
  styleUrl: './resumen.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResumenComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly metricsService = inject(MetricsService);
  private readonly destroyRef = inject(DestroyRef);

  // Fuerza a recalcular dailyChartOptions cuando cambia el esquema de color
  // del sistema operativo (hoy el tema esta fijo en light, sin efecto
  // visible todavia; mismo mecanismo que decisions-donut).
  private readonly colorSchemeTick = signal(0);

  private readonly defaultRange = defaultMetricsDayRange();

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

  // --- Solicitudes por dia y decision ---
  readonly dailyState = signal<DailyState>('loading');
  readonly dailyMetrics = signal<DailyMetric[]>([]);
  readonly dailyAsTable = signal(false);
  readonly dailySegments = DAILY_SEGMENTS;

  readonly dailyRows = computed(() =>
    this.dailyMetrics().map((day) => ({
      date: day.date,
      label: formatShortDay(day.date),
      segments: DAILY_SEGMENTS.map((segment) => dailySegmentValue(day, segment.key)),
      total: day.total_interactions,
    })),
  );

  readonly dailyChartOptions = computed<EChartsCoreOption>(() => {
    this.colorSchemeTick();
    const days = this.dailyMetrics();

    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { data: DAILY_SEGMENTS.map((segment) => segment.label), bottom: 0 },
      grid: { left: 40, right: 16, top: 24, bottom: 64, containLabel: false },
      xAxis: { type: 'category', data: days.map((day) => formatShortDay(day.date)) },
      yAxis: { type: 'value' },
      series: DAILY_SEGMENTS.map((segment) => ({
        name: segment.label,
        type: 'bar',
        stack: 'total',
        itemStyle: { color: resolveDailySegmentColor(segment.tone) },
        data: days.map((day) => dailySegmentValue(day, segment.key)),
      })),
    };
  });

  private readonly retry$ = new Subject<void>();

  constructor() {
    // matchMedia no esta disponible en todos los entornos (p.ej. jsdom en
    // los tests, sin un polyfill explicito): sin el guard, instanciar este
    // componente ahi mismo rompe.
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      const onChange = () => this.colorSchemeTick.update((tick) => tick + 1);
      media.addEventListener('change', onChange);
      this.destroyRef.onDestroy(() => media.removeEventListener('change', onChange));
    }

    combineLatest([this.route.queryParamMap, this.retry$.pipe(startWith(undefined))])
      .pipe(
        map(([params]) => resolveDateRange(params.get('from'), params.get('to'), this.defaultRange)),
        switchMap((current) => {
          this.state.set('loading');
          this.previousSummary.set(null);
          this.dailyState.set('loading');
          const previous = previousCalendarDayRange(current);

          const summary$ = this.metricsService.getSummary(current.from, current.to, METRICS_TIMEZONE).pipe(
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
          const previousSummary$ = this.metricsService.getSummary(previous.from, previous.to, METRICS_TIMEZONE).pipe(
            tap((summary) => this.previousSummary.set(summary)),
            catchError(() => {
              this.previousSummary.set(null);
              return of(null);
            }),
          );

          const daily$ = this.metricsService.getDaily(current.from, current.to, METRICS_TIMEZONE).pipe(
            tap((days) => {
              this.dailyMetrics.set(days);
              this.dailyState.set('loaded');
            }),
            catchError(() => {
              this.dailyMetrics.set([]);
              this.dailyState.set('error');
              return EMPTY;
            }),
          );

          return merge(summary$, previousSummary$, daily$);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();

    // getByCategory se pide una sola vez, sin fecha: todavia no depende del
    // from/to seleccionado (ver reporte de duplicacion con MetricsComponent).
    this.metricsService
      .getByCategory(METRICS_TIMEZONE)
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

  toggleDailyAsTable(): void {
    this.dailyAsTable.update((value) => !value);
  }
}
