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
import { calendarDaysToInstantRange, defaultMetricsRange, lastDayOfInstantRange, resolveDateRange } from '../dashboard/period';
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

  // from/to viven en los query params, como par atomico (ver
  // resolveDateRange). Si no estan los dos juntos, el default son los
  // ultimos 30 dias calendario incluyendo hoy (medianoche a medianoche
  // local), no un rango ilustrativo inventado - y ese default solo se
  // aplica mientras el par este incompleto en la URL, nunca pisa una
  // eleccion real del usuario.
  private readonly defaultRange = defaultMetricsRange();

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
      .getByCategory()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (categories) => this.categories.set(categories),
        error: () => this.categories.set([]),
      });

    // Los controles del date-range-picker reflejan el estado real, que vive
    // en los query params (no en el componente): si se navega directo con
    // ?from=...&to=..., el picker tiene que mostrar esos valores. "to" es
    // un extremo exclusivo (medianoche del dia siguiente al ultimo elegido),
    // asi que para el picker se mapea de vuelta al ultimo dia real.
    effect(() => {
      this.rangeStart.setValue(new Date(this.fromParam()), { emitEvent: false });
      this.rangeEnd.setValue(lastDayOfInstantRange(this.toParam()), { emitEvent: false });
    });
  }

  // Se dispara una sola vez, cuando el calendario se cierra (selection
  // completa o el usuario lo descarta) - no en cada clic individual. Si el
  // usuario cerro sin completar el rango, rangeEnd queda null y no se
  // navega. from es la medianoche local del primer dia elegido; to es la
  // medianoche local del dia SIGUIENTE al ultimo, para no dejar afuera el
  // tramo final del ultimo dia.
  onRangeChanged(): void {
    const start = this.rangeStart.value;
    const end = this.rangeEnd.value;
    if (!start || !end) return;

    const range = calendarDaysToInstantRange(start, end);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { from: range.from, to: range.to },
      queryParamsHandling: 'merge',
    });
  }
}
