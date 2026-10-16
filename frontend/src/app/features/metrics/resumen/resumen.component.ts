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
  daysInRange,
  defaultMetricsDayRange,
  parseIsoDateLocal,
  previousCalendarDayRange,
  resolveDateRange,
} from '../../dashboard/period';
import { percentGrowth, ppDelta, rate, rawDelta } from '../../../shared/kpi-metrics';
import { decisionStatus, STATUS_FILTER_OPTIONS } from '../../interactions/interaction-status';
import { DecisionSegmentTone, DECISION_SEGMENTS, decisionSegmentValue } from '../decision-segments';
import { KpiCardComponent } from './kpi-card/kpi-card.component';
import { MetricsSummaryResponse } from '../../../api/models/metrics-summary-response';
import { CategoryMetric } from '../../../api/models/category-metric';
import { DailyMetric } from '../../../api/models/daily-metric';
import { HeatmapCell } from '../../../api/models/heatmap-cell';

export type ResumenState = 'loading' | 'error' | 'empty' | 'loaded';
export type DailyState = 'loading' | 'error' | 'rangeTooLong' | 'loaded';
export type HeatmapState = 'loading' | 'error' | 'loaded';

// Limite del contrato de GET /api/metrics/daily (no es una regla de
// calendario generica, por eso no va en period.ts).
const MAX_DAILY_RANGE_DAYS = 366;

// El canvas de echarts no puede resolver var(--token) solo, hace falta el
// color literal, leido en runtime (mismo patron que decisions-donut).
const DAILY_SEGMENT_CSS_VAR: Record<DecisionSegmentTone, string> = {
  success: '--app-color-success',
  warning: '--app-color-warning',
  error: '--mat-sys-error',
  neutral: '--app-color-text-secondary',
  resolved: '--mat-sys-tertiary',
};

function resolveDailySegmentColor(tone: DecisionSegmentTone): string {
  return getComputedStyle(document.documentElement).getPropertyValue(DAILY_SEGMENT_CSS_VAR[tone]).trim();
}

const SHORT_DAY_FORMATTER = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' });

// No reusa formatShortDate (shared/): esa incluye hora y minuto, pensada
// para timestamps, y aca "date" es un dia AAAA-MM-DD sin hora.
function formatShortDay(day: string): string {
  return SHORT_DAY_FORMATTER.format(parseIsoDateLocal(day));
}

// Nombres de dia con Intl en vez de un array de strings a mano: 1/1/2024 es
// lunes, asi que el indice 0 de esta semana de referencia es lunes y el 6 es
// domingo, mismo orden que "weekday" del contrato (1=lunes...7=domingo).
const WEEKDAY_LABELS = Array.from({ length: 7 }, (_, i) => {
  const label = new Intl.DateTimeFormat('es', { weekday: 'long' }).format(new Date(2024, 0, 1 + i));
  return label.charAt(0).toUpperCase() + label.slice(1);
});

// El canvas de echarts no puede resolver var(--token) solo, hace falta el
// color literal, leido en runtime (mismo mecanismo que decisions-donut y
// la serie diaria de arriba).
function resolveHeatmapColors(): [string, string] {
  const styles = getComputedStyle(document.documentElement);
  return [styles.getPropertyValue('--mat-sys-primary-container').trim(), styles.getPropertyValue('--mat-sys-primary').trim()];
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
  readonly dailySegments = DECISION_SEGMENTS;

  readonly dailyRows = computed(() =>
    this.dailyMetrics().map((day) => ({
      date: day.date,
      label: formatShortDay(day.date),
      segments: DECISION_SEGMENTS.map((segment) => decisionSegmentValue(day, segment.key)),
      total: day.total_interactions,
    })),
  );

  readonly dailyChartOptions = computed<EChartsCoreOption>(() => {
    this.colorSchemeTick();
    const days = this.dailyMetrics();

    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { data: DECISION_SEGMENTS.map((segment) => segment.label), bottom: 0 },
      grid: { left: 40, right: 16, top: 24, bottom: 64, containLabel: false },
      xAxis: { type: 'category', data: days.map((day) => formatShortDay(day.date)) },
      yAxis: { type: 'value' },
      series: DECISION_SEGMENTS.map((segment) => ({
        name: segment.label,
        type: 'bar',
        stack: 'total',
        itemStyle: { color: resolveDailySegmentColor(segment.tone) },
        data: days.map((day) => decisionSegmentValue(day, segment.key)),
      })),
    };
  });

  // --- Mapa de calor de actividad ---
  readonly heatmapState = signal<HeatmapState>('loading');
  readonly heatmapCells = signal<HeatmapCell[]>([]);
  readonly heatmapTotal = computed(() => this.heatmapCells().reduce((sum, cell) => sum + cell.count, 0));

  readonly heatmapChartOptions = computed<EChartsCoreOption>(() => {
    this.colorSchemeTick();
    const cells = this.heatmapCells();
    const maxCount = Math.max(1, ...cells.map((cell) => cell.count));
    const [lightColor, fullColor] = resolveHeatmapColors();

    return {
      tooltip: {
        position: 'top',
        formatter: (params: { value: [number, number, number] }) => {
          const [hour, weekdayIndex, count] = params.value;
          return `${WEEKDAY_LABELS[weekdayIndex]}, ${hour}:00 — ${count}`;
        },
      },
      grid: { left: 70, right: 16, top: 24, bottom: 70, containLabel: false },
      xAxis: { type: 'category', data: Array.from({ length: 24 }, (_, hour) => `${hour}h`), splitArea: { show: true } },
      yAxis: { type: 'category', data: WEEKDAY_LABELS, inverse: true, splitArea: { show: true } },
      visualMap: {
        type: 'continuous',
        min: 0,
        max: maxCount,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: 0,
        inRange: { color: [lightColor, fullColor] },
      },
      series: [
        {
          type: 'heatmap',
          data: cells.map((cell) => [cell.hour, cell.weekday - 1, cell.count]),
        },
      ],
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
          this.heatmapState.set('loading');
          this.byCategory.set([]);
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

          // Mas de 366 dias: el backend responde 422, no tiene sentido
          // pedirlo. Se corta antes, sin llamar a getDaily.
          const daily$ =
            daysInRange(current) > MAX_DAILY_RANGE_DAYS
              ? of(null).pipe(
                  tap(() => {
                    this.dailyMetrics.set([]);
                    this.dailyState.set('rangeTooLong');
                  }),
                )
              : this.metricsService.getDaily(current.from, current.to, METRICS_TIMEZONE).pipe(
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

          const heatmap$ = this.metricsService.getHeatmap(current.from, current.to, METRICS_TIMEZONE).pipe(
            tap((cells) => {
              this.heatmapCells.set(cells);
              this.heatmapState.set('loaded');
            }),
            catchError(() => {
              this.heatmapCells.set([]);
              this.heatmapState.set('error');
              return EMPTY;
            }),
          );

          // Sin estado de carga/error propio: si falla, la lista queda vacia
          // y la tarjeta cae en su mensaje de "Todavia no hay categorias"
          // existente (pendiente: darle el mismo tratamiento de error con
          // Reintentar que ya tienen daily/heatmap).
          const byCategory$ = this.metricsService.getByCategory(METRICS_TIMEZONE, current.from, current.to).pipe(
            tap((categories) => this.byCategory.set(categories)),
            catchError(() => {
              this.byCategory.set([]);
              return of(null);
            }),
          );

          return merge(summary$, previousSummary$, daily$, heatmap$, byCategory$);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
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
