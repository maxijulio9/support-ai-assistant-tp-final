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
import { MetricsService } from './metrics.service';
import { METRICS_TIMEZONE, defaultMetricsDayRange, parseIsoDateLocal, resolveDateRange, toIsoDate } from '../dashboard/period';
import { STATUS_FILTER_OPTIONS } from '../interactions/interaction-status';
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

  readonly statusOptions = STATUS_FILTER_OPTIONS;
  readonly categories = signal<CategoryMetric[]>([]);

  // Deshabilitados hasta que el backend soporte filtrar: el valor mostrado
  // es fijo en "Todas las categorías"/"Todas las decisiones" (null).
  readonly categoryFilterValue = signal<string | null>(null);
  readonly decisionFilterValue = signal<string | null>(null);

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

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { from: toIsoDate(start), to: toIsoDate(end) },
      queryParamsHandling: 'merge',
    });
  }
}
