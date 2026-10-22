import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../core/auth/auth.service';
import { DashboardService } from './dashboard.service';
import { computePeriodRanges, PeriodOption } from './period';
import { DecisionsDonutComponent, DonutSegment } from './decisions-donut.component';
import { decisionStatus, STATUS_FILTER_OPTIONS } from '../interactions/interaction-status';
import { safeTicketUrl } from '../../shared/safe-ticket-url';
import { formatRelativeTime } from '../../shared/format-relative-time';
import { rate, ppDelta, rawDelta } from '../../shared/kpi-metrics';
import { MetricsSummaryResponse } from '../../api/models/metrics-summary-response';
import { CategoryMetric } from '../../api/models/category-metric';
import { InteractionListItem } from '../../api/models/interaction-list-item';

export type DashboardState = 'loading' | 'error' | 'empty' | 'loaded';

// Campo de MetricsSummaryResponse que corresponde a cada decision, en el
// mismo orden que STATUS_FILTER_OPTIONS (interaction-status.ts), para no
// inventar ni el orden ni las etiquetas.
const DECISION_COUNT_FIELD: Record<string, keyof MetricsSummaryResponse> = {
  AUTO_PUBLISH: 'auto_publish_count',
  NEEDS_REVIEW: 'needs_review_count',
  ESCALATE: 'escalate_count',
  REQUEST_INFO: 'request_info_count',
  DISCARDED: 'discarded_count',
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [DecimalPipe, RouterLink, MatButtonModule, MatIconModule, MatTooltipModule, DecisionsDonutComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent {
  private readonly authService = inject(AuthService);
  private readonly dashboardService = inject(DashboardService);
  private readonly destroyRef = inject(DestroyRef);

  readonly periodOption = signal<PeriodOption>('30d');
  readonly state = signal<DashboardState>('loading');
  readonly pendingReviewLimit = this.dashboardService.pendingReviewLimit;

  readonly summary = signal<MetricsSummaryResponse | null>(null);
  readonly previousSummary = signal<MetricsSummaryResponse | null>(null);
  readonly byCategory = signal<CategoryMetric[]>([]);
  readonly pendingReview = signal<InteractionListItem[]>([]);
  readonly recentActivity = signal<InteractionListItem[]>([]);
  readonly lastUpdatedAt = signal<string | null>(null);

  readonly firstName = computed(() => {
    const fullName = this.authService.profile()?.full_name;
    if (!fullName) return null;
    const first = fullName.trim().split(/\s+/)[0];
    return first || null;
  });

  readonly periodLabel = new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric' }).format(new Date());

  // --- Banner de revision ---
  readonly pendingReviewCount = computed(() => this.pendingReview().length);
  readonly pendingReviewTruncated = computed(
    () => this.pendingReviewCount() === this.dashboardService.pendingReviewLimit,
  );
  // El listado viene DESC por created_at: la ultima fila es la mas antigua.
  readonly oldestPendingCreatedAt = computed(() => {
    const items = this.pendingReview();
    return items.length > 0 ? items[items.length - 1].created_at : null;
  });

  // --- KPIs ---
  // Total de solicitudes se sigue calculando (lo usan el donut y el footer),
  // pero dejo de ser una tarjeta de KPI propia: ese lugar lo ocupa "En
  // revision ahora" (banner de abajo), igual que en el mock de Inicio. El
  // total y su tendencia quedan para la pantalla de Metricas.
  readonly totalInteractions = computed(() => this.summary()?.total_interactions ?? null);

  readonly autoPublishRate = computed(() => {
    const s = this.summary();
    return s ? rate(s.auto_publish_count, s.total_interactions) : null;
  });
  private readonly previousAutoPublishRate = computed(() => {
    const s = this.previousSummary();
    return s ? rate(s.auto_publish_count, s.total_interactions) : null;
  });
  readonly autoPublishDeltaPp = computed(() => ppDelta(this.autoPublishRate(), this.previousAutoPublishRate()));

  readonly escalateRate = computed(() => {
    const s = this.summary();
    return s ? rate(s.escalate_count, s.total_interactions) : null;
  });
  private readonly previousEscalateRate = computed(() => {
    const s = this.previousSummary();
    return s ? rate(s.escalate_count, s.total_interactions) : null;
  });
  readonly escalateDeltaPp = computed(() => ppDelta(this.escalateRate(), this.previousEscalateRate()));

  readonly avgConfidence = computed(() => this.summary()?.avg_confidence_score ?? null);
  private readonly previousAvgConfidence = computed(() => this.previousSummary()?.avg_confidence_score ?? null);
  readonly avgConfidenceDelta = computed(() => rawDelta(this.avgConfidence(), this.previousAvgConfidence()));

  // --- Donut de decisiones ---
  readonly donutSegments = computed<DonutSegment[]>(() => {
    const s = this.summary();
    if (!s) return [];

    const segments = STATUS_FILTER_OPTIONS.map((option) => ({
      label: option.label,
      value: (s[DECISION_COUNT_FIELD[option.value]] as number) ?? 0,
      tone: decisionStatus(option.value).tone,
    }));

    const known = segments.reduce((sum, segment) => sum + segment.value, 0);
    const other = s.total_interactions - known;
    if (other > 0) {
      segments.push({ label: 'Otras', value: other, tone: 'neutral' });
    }
    return segments;
  });

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

  readonly safeTicketUrl = safeTicketUrl;
  readonly statusFor = decisionStatus;
  readonly relativeTime = formatRelativeTime;

  constructor() {
    this.loadAll();
  }

  setPeriod(option: PeriodOption): void {
    if (this.periodOption() === option) return;
    this.periodOption.set(option);
    this.loadAll();
  }

  retry(): void {
    this.loadAll();
  }

  private loadAll(): void {
    this.state.set('loading');
    const { current, previous } = computePeriodRanges(this.periodOption());

    this.dashboardService
      .getSummary(current.from, current.to)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (summary) => {
          this.summary.set(summary);
          this.lastUpdatedAt.set(new Date().toISOString());
          this.state.set(summary.total_interactions === 0 ? 'empty' : 'loaded');
        },
        error: () => {
          this.summary.set(null);
          this.state.set('error');
        },
      });

    // El periodo anterior es solo para el delta de cada KPI: si falla, el
    // KPI se muestra sin delta, no bloquea el resto de la pantalla.
    this.previousSummary.set(null);
    this.dashboardService
      .getSummary(previous.from, previous.to)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (summary) => this.previousSummary.set(summary),
        error: () => this.previousSummary.set(null),
      });

    this.dashboardService
      .getByCategory()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (categories) => this.byCategory.set(categories),
        error: () => this.byCategory.set([]),
      });

    this.dashboardService
      .listPendingReview()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items) => this.pendingReview.set(items),
        error: () => this.pendingReview.set([]),
      });

    this.dashboardService
      .listRecent()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items) => this.recentActivity.set(items),
        error: () => this.recentActivity.set([]),
      });
  }
}
