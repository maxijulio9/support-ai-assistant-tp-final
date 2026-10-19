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
import { METRICS_TIMEZONE, defaultMetricsDayRange, resolveDateRange } from '../../dashboard/period';
import { DECISION_SEGMENTS, decisionSegmentValue, roundedSegmentPercentages } from '../decision-segments';
import { agreedThresholds } from '../confidence-thresholds';
import { sortByConfidence } from '../category-confidence-order';
import { MetricsFilters, resolveMetricsFilters } from '../metrics-filters';
import { MetricsSummaryResponse } from '../../../api/models/metrics-summary-response';
import { ConfidenceInterval } from '../../../api/models/confidence-interval';
import { ProjectThresholdsItem } from '../../../api/models/project-thresholds-item';
import { CategoryMetric } from '../../../api/models/category-metric';

export type CategoryConfidenceState = 'loading' | 'error' | 'loaded';

export type DecisionesConfianzaState = 'loading' | 'error' | 'empty' | 'loaded';
export type ConfidenceState = 'loading' | 'error' | 'loaded';

// Render item de la serie custom del histograma: dibuja un rectangulo exacto
// de lower_bound a upper_bound, no una barra de ancho automatico (que en un
// eje de valor queda angosta y con huecos entre intervalos).
interface RenderItemApi {
  value(dimension: number): number;
  coord(point: [number, number]): [number, number];
  style(): Record<string, unknown>;
}

function renderConfidenceBar(_params: unknown, api: RenderItemApi) {
  const lower = api.value(0);
  const upper = api.value(1);
  const count = api.value(2);
  const topLeft = api.coord([lower, count]);
  const bottomRight = api.coord([upper, 0]);

  return {
    type: 'rect',
    shape: {
      x: topLeft[0],
      y: topLeft[1],
      width: bottomRight[0] - topLeft[0],
      height: bottomRight[1] - topLeft[1],
    },
    style: api.style(),
  };
}

// El canvas de echarts no puede resolver var(--token) solo, hace falta el
// color literal, leido en runtime (mismo patron que el resto de los graficos
// de Metricas).
interface ConfidenceColors {
  bar: string;
  barBorder: string;
  autoPublish: string;
  needsReview: string;
  onColor: string;
}

function resolveConfidenceColors(): ConfidenceColors {
  const styles = getComputedStyle(document.documentElement);
  return {
    bar: styles.getPropertyValue('--mat-sys-primary').trim(),
    barBorder: styles.getPropertyValue('--mat-sys-surface').trim(),
    autoPublish: styles.getPropertyValue('--app-color-success').trim(),
    needsReview: styles.getPropertyValue('--app-color-warning').trim(),
    onColor: styles.getPropertyValue('--mat-sys-on-primary').trim(),
  };
}

function intervalLabel(interval: ConfidenceInterval): string {
  const lower = interval.lower_bound.toFixed(1);
  const upper = interval.upper_bound.toFixed(1);
  return `${lower}-${upper}`;
}

@Component({
  selector: 'app-metrics-decisiones-confianza',
  standalone: true,
  imports: [DecimalPipe, MatButtonModule, MatIconModule, MatSlideToggleModule, NgxEchartsDirective],
  templateUrl: './decisiones-confianza.component.html',
  styleUrl: './decisiones-confianza.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DecisionesConfianzaComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly metricsService = inject(MetricsService);
  private readonly destroyRef = inject(DestroyRef);

  // Fuerza a recalcular confidenceChartOptions cuando cambia el esquema de
  // color del sistema operativo (mismo mecanismo que los graficos de Resumen).
  private readonly colorSchemeTick = signal(0);

  private readonly defaultRange = defaultMetricsDayRange();

  readonly state = signal<DecisionesConfianzaState>('loading');
  readonly summary = signal<MetricsSummaryResponse | null>(null);
  readonly distributionAsTable = signal(false);

  readonly totalInteractions = computed(() => this.summary()?.total_interactions ?? null);

  readonly activeFilters = signal<MetricsFilters>({ category: null, decision: null });
  readonly hasActiveFilters = computed(() => this.activeFilters().category !== null || this.activeFilters().decision !== null);

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

  // --- Distribucion de confianza ---
  readonly confidenceState = signal<ConfidenceState>('loading');
  readonly intervals = signal<ConfidenceInterval[]>([]);
  readonly withoutScoreCount = signal(0);
  readonly confidenceTotal = signal(0);
  readonly thresholds = signal<ProjectThresholdsItem[]>([]);
  readonly confidenceAsTable = signal(false);

  readonly thresholdsAgreement = computed(() => agreedThresholds(this.thresholds()));
  readonly thresholdsDisagree = computed(() => {
    const agreed = this.thresholdsAgreement();
    return this.thresholds().length > 1 && (agreed.thresholdAutoPublish === null || agreed.thresholdNeedsReview === null);
  });

  // Filas de la tabla: los 10 intervalos mas una fila final "Sin puntaje",
  // asi la suma de filas da total_interactions.
  readonly confidenceRows = computed(() => {
    const total = this.confidenceTotal();
    const percentOf = (count: number) => (total > 0 ? (count / total) * 100 : 0);

    const rows = this.intervals().map((interval) => ({
      label: intervalLabel(interval),
      count: interval.count,
      percent: percentOf(interval.count),
    }));

    rows.push({
      label: 'Sin puntaje',
      count: this.withoutScoreCount(),
      percent: percentOf(this.withoutScoreCount()),
    });

    return rows;
  });

  readonly confidenceChartOptions = computed<EChartsCoreOption>(() => {
    this.colorSchemeTick();
    const intervals = this.intervals();
    const colors = resolveConfidenceColors();
    const agreed = this.thresholdsAgreement();
    const maxCount = Math.max(1, ...intervals.map((interval) => interval.count));

    // Las dos etiquetas van en forma de pildora, arriba del todo, una mas
    // separada del eje que la otra (distance distinto) para que no se pisen
    // si los dos umbrales caen cerca.
    const markLineData: Record<string, unknown>[] = [];
    if (agreed.thresholdAutoPublish !== null) {
      markLineData.push({
        xAxis: agreed.thresholdAutoPublish,
        lineStyle: { color: colors.autoPublish, width: 2 },
        label: {
          formatter: `Publicación automática ${agreed.thresholdAutoPublish.toFixed(2)}`,
          position: 'end',
          align: 'center',
          distance: 8,
          color: colors.onColor,
          backgroundColor: colors.autoPublish,
          padding: [2, 6],
          borderRadius: 4,
          fontSize: 11,
        },
      });
    }
    if (agreed.thresholdNeedsReview !== null) {
      markLineData.push({
        xAxis: agreed.thresholdNeedsReview,
        lineStyle: { color: colors.needsReview, width: 2 },
        label: {
          formatter: `Revisión ${agreed.thresholdNeedsReview.toFixed(2)}`,
          position: 'end',
          align: 'center',
          distance: 28,
          color: colors.onColor,
          backgroundColor: colors.needsReview,
          padding: [2, 6],
          borderRadius: 4,
          fontSize: 11,
        },
      });
    }

    return {
      tooltip: {
        formatter: (params: { data: { value: [number, number, number]; upperInclusive: boolean } }) => {
          const [lower, upper, count] = params.data.value;
          const closingBracket = params.data.upperInclusive ? ']' : ')';
          return `[${lower.toFixed(1)}, ${upper.toFixed(1)}${closingBracket}: ${count}`;
        },
      },
      grid: { left: 50, right: 24, top: 64, bottom: 32, containLabel: false },
      xAxis: { type: 'value', min: 0, max: 1, interval: 0.1 },
      // Eje de valor sobre una serie custom: no infiere el rango de "y" solo
      // (los datos son [lower, upper, count], no [x, y]), asi que el maximo
      // se fija a mano. minInterval 1 evita ticks fraccionarios en un eje de
      // conteos.
      yAxis: { type: 'value', min: 0, max: maxCount, minInterval: 1, name: 'Solicitudes' },
      series: [
        {
          type: 'custom',
          renderItem: renderConfidenceBar,
          itemStyle: { color: colors.bar, borderColor: colors.barBorder, borderWidth: 2 },
          data: intervals.map((interval) => ({
            value: [interval.lower_bound, interval.upper_bound, interval.count],
            upperInclusive: interval.upper_inclusive,
          })),
          markLine: {
            silent: true,
            symbol: 'none',
            z: 10,
            data: markLineData,
          },
        },
      ],
    };
  });

  // --- Confianza media por categoria ---
  readonly categoryConfidenceState = signal<CategoryConfidenceState>('loading');
  readonly byCategory = signal<CategoryMetric[]>([]);
  readonly categoryConfidenceAsTable = signal(false);

  readonly categoryConfidenceRows = computed(() =>
    sortByConfidence(this.byCategory()).map((category) => ({
      category: category.category,
      score: category.avg_confidence_score,
      total: category.total_interactions,
      widthPercent: (category.avg_confidence_score ?? 0) * 100,
    })),
  );

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
        map(([params]) => ({
          range: resolveDateRange(params.get('from'), params.get('to'), this.defaultRange),
          filters: resolveMetricsFilters(params.get('category'), params.get('decision')),
        })),
        switchMap(({ range, filters }) => {
          this.state.set('loading');
          this.confidenceState.set('loading');
          this.categoryConfidenceState.set('loading');
          this.activeFilters.set(filters);

          const summary$ = this.metricsService.getSummary(range.from, range.to, METRICS_TIMEZONE, filters).pipe(
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

          const confidenceDistribution$ = this.metricsService
            .getConfidenceDistribution(range.from, range.to, METRICS_TIMEZONE, filters)
            .pipe(
              tap((response) => {
                this.intervals.set(response.intervals);
                this.withoutScoreCount.set(response.without_score_count);
                this.confidenceTotal.set(response.total_interactions);
                this.confidenceState.set('loaded');
              }),
              catchError(() => {
                this.intervals.set([]);
                this.withoutScoreCount.set(0);
                this.confidenceTotal.set(0);
                this.confidenceState.set('error');
                return EMPTY;
              }),
            );

          // Si falla, el histograma se muestra igual: agreedThresholds() da
          // null con un arreglo vacio, asi que simplemente no se dibujan las
          // lineas de umbral. No recibe filtros: el contrato no los define
          // para este endpoint.
          const thresholds$ = this.metricsService.getThresholds().pipe(
            tap((projects) => this.thresholds.set(projects)),
            catchError(() => {
              this.thresholds.set([]);
              return of(null);
            }),
          );

          const byCategory$ = this.metricsService
            .getByCategory(METRICS_TIMEZONE, range.from, range.to, filters)
            .pipe(
              tap((categories) => {
                this.byCategory.set(categories);
                this.categoryConfidenceState.set('loaded');
              }),
              catchError(() => {
                this.byCategory.set([]);
                this.categoryConfidenceState.set('error');
                return EMPTY;
              }),
            );

          return merge(summary$, confidenceDistribution$, thresholds$, byCategory$);
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

  toggleConfidenceAsTable(): void {
    this.confidenceAsTable.update((value) => !value);
  }

  toggleCategoryConfidenceAsTable(): void {
    this.categoryConfidenceAsTable.update((value) => !value);
  }
}
