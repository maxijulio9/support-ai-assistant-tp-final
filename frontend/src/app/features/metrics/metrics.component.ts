import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { map } from 'rxjs';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MetricsService } from './metrics.service';
import { METRICS_TIMEZONE, defaultMetricsDayRange, parseIsoDateLocal, resolveDateRange, toIsoDate } from '../dashboard/period';
import { resolveMetricsFilters } from './metrics-filters';
import { DECISION_FILTER_OPTIONS } from './decision-segments';
import { CategoryMetric } from '../../api/models/category-metric';

@Component({
  selector: 'app-metrics',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatSelectModule,
    MatDatepickerModule,
    MatTabsModule,
    MatTooltipModule,
    MatChipsModule,
  ],
  templateUrl: './metrics.component.html',
  styleUrl: './metrics.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MetricsComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly metricsService = inject(MetricsService);
  private readonly destroyRef = inject(DestroyRef);

  readonly decisionOptions = DECISION_FILTER_OPTIONS;
  readonly categories = signal<CategoryMetric[]>([]);

  // from/to viven en los query params, como dias AAAA-MM-DD (ver
  // resolveDateRange). Si no estan los dos juntos o no son fechas validas,
  // el default son los ultimos 30 dias calendario incluyendo hoy, no un
  // rango ilustrativo inventado - y ese default solo se aplica mientras el
  // par este incompleto o invalido en la URL, nunca pisa una eleccion real
  // del usuario.
  private readonly defaultRange = defaultMetricsDayRange();

  private readonly queryRange = toSignal(
    this.route.queryParamMap.pipe(
      map((params) => resolveDateRange(params.get('from'), params.get('to'), this.defaultRange)),
    ),
    { initialValue: this.defaultRange },
  );

  readonly fromParam = computed(() => this.queryRange().from);
  readonly toParam = computed(() => this.queryRange().to);

  // category y decision tambien viven en los query params: cada pestaña los
  // vuelve a leer por su cuenta (mismo criterio que from/to), este signal es
  // solo para que el encabezado muestre los selects y los chips.
  private readonly queryFilters = toSignal(
    this.route.queryParamMap.pipe(map((params) => resolveMetricsFilters(params.get('category'), params.get('decision')))),
    { initialValue: { category: null, decision: null } },
  );

  readonly categoryFilterValue = computed(() => this.queryFilters().category);
  readonly decisionFilterValue = computed(() => this.queryFilters().decision);
  readonly hasActiveFilters = computed(() => this.categoryFilterValue() !== null || this.decisionFilterValue() !== null);

  // Si el valor de la URL no esta en la lista de categorias ya cargada
  // (por ejemplo, llego por un link viejo), se agrega igual a las opciones
  // mientras este activo, para que el select lo muestre seleccionado.
  readonly categoryOptionNames = computed(() => {
    const names = this.categories().map((category) => category.category);
    const current = this.categoryFilterValue();
    return current !== null && !names.includes(current) ? [...names, current] : names;
  });

  readonly decisionFilterLabel = computed(() => {
    const value = this.decisionFilterValue();
    return value !== null ? (this.decisionOptions.find((option) => option.value === value)?.label ?? value) : null;
  });

  readonly rangeStart = new FormControl<Date | null>(null);
  readonly rangeEnd = new FormControl<Date | null>(null);

  constructor() {
    this.metricsService
      .getByCategory(METRICS_TIMEZONE)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (categories) => this.categories.set(categories),
        error: () => this.categories.set([]),
      });

    // Los controles del date-range-picker reflejan el estado real, que vive
    // en los query params (no en el componente): si se navega directo con
    // ?from=...&to=..., el picker tiene que mostrar esos valores.
    effect(() => {
      this.rangeStart.setValue(parseIsoDateLocal(this.fromParam()), { emitEvent: false });
      this.rangeEnd.setValue(parseIsoDateLocal(this.toParam()), { emitEvent: false });
    });
  }

  // Se dispara una sola vez, cuando el calendario se cierra (seleccion
  // completa o el usuario lo descarta) - no en cada clic individual. Si el
  // usuario cerro sin completar el rango, rangeEnd queda null y no se
  // navega.
  onRangeChanged(): void {
    const start = this.rangeStart.value;
    const end = this.rangeEnd.value;
    if (!start || !end) return;

    this.updateQueryParams({ from: toIsoDate(start), to: toIsoDate(end) });
  }

  onCategoryFilterChange(value: string | null): void {
    this.updateQueryParams({ category: value });
  }

  onDecisionFilterChange(value: string | null): void {
    this.updateQueryParams({ decision: value });
  }

  // Saca solo category y decision, from y to quedan como estan.
  clearFilters(): void {
    this.updateQueryParams({ category: null, decision: null });
  }

  private updateQueryParams(queryParams: Record<string, string | null>): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
    });
  }
}
