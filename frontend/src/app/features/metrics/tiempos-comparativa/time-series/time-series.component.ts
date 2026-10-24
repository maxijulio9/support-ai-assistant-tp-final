import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { NgxEchartsDirective } from 'ngx-echarts';
import type { EChartsCoreOption } from 'echarts/core';
import { cohortAccentVar } from '../cohort-card';
import { cohortDescription, cohortLabel } from '../response-times-format';
import { ResponseTimesLike } from '../response-times.types';
import { Granularity, buildSeriesPoints, hasSeriesData } from '../time-series';
import { SeriesChartColors, buildSeriesChartOptions, resolveSeriesScale } from '../time-series-chart';

const DEFAULT_COHORT = 'automatic';
// La atencion manual previa no tiene serie temporal
const COHORT_WITHOUT_SERIES = 'baseline';

// El canvas de echarts no puede resolver var(--token) solo: se lee el color
// literal en runtime, como en los otros graficos de Metricas.
function readColor(variable: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
}

@Component({
  selector: 'app-time-series',
  standalone: true,
  imports: [MatButtonToggleModule, MatFormFieldModule, MatIconModule, MatSelectModule, NgxEchartsDirective],
  templateUrl: './time-series.component.html',
  styleUrl: './time-series.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimeSeriesComponent {
  readonly data = input.required<ResponseTimesLike>();

  readonly granularity = signal<Granularity>('weekly');
  private readonly selectedCohort = signal(DEFAULT_COHORT);

  readonly cohortOptions = computed(() =>
    this.data()
      .cohorts.filter((cohort) => cohort.cohort !== COHORT_WITHOUT_SERIES)
      .map((cohort) => ({ value: cohort.cohort, label: cohortLabel(cohort.cohort) })),
  );

  // Si la cohorte elegida ya no esta entre las opciones, la primera
  readonly cohortKey = computed(() => {
    const options = this.cohortOptions();
    const selected = this.selectedCohort();
    return options.some((option) => option.value === selected) ? selected : (options[0]?.value ?? DEFAULT_COHORT);
  });

  readonly cohortText = computed(() => cohortDescription(this.cohortKey()));
  readonly minSample = computed(() => this.data().min_sample);
  readonly targetSeconds = computed(() => this.data().first_response_target_seconds);

  readonly points = computed(() =>
    buildSeriesPoints(
      this.data().cohorts.find((cohort) => cohort.cohort === this.cohortKey()),
      this.granularity(),
      this.minSample(),
    ),
  );
  readonly hasData = computed(() => hasSeriesData(this.points()));

  // Sale de la misma funcion que decide la escala del eje
  readonly scaleNote = computed(() => (this.hasData() ? resolveSeriesScale(this.points(), this.targetSeconds()).note : null));

  readonly ariaLabel = computed(
    () =>
      `Mediana y p90 de la primera respuesta, ${this.granularity() === 'weekly' ? 'por semana' : 'por día'}, ` +
      `de la atención ${cohortLabel(this.cohortKey()).toLowerCase()}`,
  );

  readonly chartOptions = computed<EChartsCoreOption>(() => {
    const colors: SeriesChartColors = {
      line: readColor(this.accentVariable()),
      target: readColor('--mat-sys-on-surface'),
      text: readColor('--app-color-text-secondary'),
      grid: readColor('--mat-sys-outline-variant'),
      surface: readColor('--mat-sys-surface'),
    };
    return buildSeriesChartOptions({
      points: this.points(),
      granularity: this.granularity(),
      minSample: this.minSample(),
      targetSeconds: this.targetSeconds(),
      colors,
    });
  });

  private accentVariable(): string {
    return cohortAccentVar(this.cohortKey());
  }

  onCohortChange(value: string): void {
    this.selectedCohort.set(value);
  }

  onGranularityChange(value: Granularity): void {
    this.granularity.set(value);
  }
}
