import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { EMPTY, Subject, catchError, combineLatest, distinctUntilChanged, map, of, startWith, switchMap, tap } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MetricsService } from '../metrics.service';
import { METRICS_TIMEZONE, defaultMetricsDayRange, resolveDateRange } from '../../dashboard/period';
import { resolveMetricsFilters } from '../metrics-filters';
import { ProjectThresholdsItem } from '../../../api/models/project-thresholds-item';
import { CohortCardComponent } from './cohort-card/cohort-card.component';
import { CategoryComparisonComponent } from './category-comparison/category-comparison.component';
import { baselineHasTickets, buildCategoryComparison, categoryComparisonDisplay } from './category-comparison';
import { closureNote } from './closure';
import { TimeSeriesComponent } from './time-series/time-series.component';
import { OutcomesBreakdownComponent } from './outcomes-breakdown/outcomes-breakdown.component';
import { buildOutcomeRows } from './outcomes-breakdown';
import { MAIN_COHORTS, SYSTEM_RESPONSE_COHORTS, buildCohortCard, hasAnyTickets, pickCohorts } from './cohort-card';
import { ProjectOption, buildProjectOptions } from './project-options';
import { RESPONSE_TIMES_ERROR_MESSAGE, responseTimesErrorMessage } from './response-times-error';
import { ALL_PROJECTS, buildResponseTimesFilters, resolveProjectSelection } from './response-times-filters';
import { cohortLabel, formatDuration } from './response-times-format';
import { ResponseTimesResponse } from '../../../api/models/response-times-response';

export type TiemposState = 'loading' | 'error' | 'empty' | 'loaded';

@Component({
  selector: 'app-metrics-tiempos-comparativa',
  standalone: true,
  imports: [CategoryComparisonComponent, CohortCardComponent, OutcomesBreakdownComponent, TimeSeriesComponent, MatButtonModule, MatFormFieldModule, MatIconModule, MatSelectModule, MatSlideToggleModule],
  templateUrl: './tiempos-comparativa.component.html',
  styleUrl: './tiempos-comparativa.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TiemposComparativaComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly metricsService = inject(MetricsService);
  private readonly destroyRef = inject(DestroyRef);

  readonly allProjectsValue = ALL_PROJECTS;
  readonly baselineLabel = cohortLabel('baseline');

  readonly state = signal<TiemposState>('loading');
  readonly optionsReady = signal(false);
  readonly projectOptions = signal<ProjectOption[]>([]);
  readonly selection = signal<string>(ALL_PROJECTS);
  readonly data = signal<ResponseTimesResponse | null>(null);
  readonly errorMessage = signal<string>(RESPONSE_TIMES_ERROR_MESSAGE);

  readonly hasProjects = computed(() => this.projectOptions().length > 0);
  readonly isAllProjects = computed(() => this.selection() === ALL_PROJECTS);
  readonly targetText = computed(() => {
    const target = this.data()?.first_response_target_seconds;
    return target === null || target === undefined ? null : formatDuration(target);
  });

  // Fila principal: las tres atenciones que se comparan entre si. Aparte van
  // el acuse de recibo y el pedido de informacion, que no son una solucion.
  readonly mainCards = computed(() => this.buildCards(MAIN_COHORTS));
  readonly systemResponseCards = computed(() => this.buildCards(SYSTEM_RESPONSE_COHORTS));

  // Apagado por defecto y sin persistir: el cierre es indicativo
  readonly showClosure = signal(false);
  readonly closureNoteText = computed(() => closureNote(this.data()?.cohorts ?? []));

  readonly minSample = computed(() => this.data()?.min_sample ?? 0);

  private findCohort(key: string) {
    return this.data()?.cohorts.find((cohort) => cohort.cohort === key);
  }

  // Compara solo la primera respuesta de la automatica contra la atencion
  // manual previa, que es la unica metrica con la misma regla en ambas.
  readonly comparisonRows = computed(() =>
    buildCategoryComparison(this.findCohort('automatic'), this.findCohort('baseline'), this.minSample()),
  );
  readonly comparisonDisplay = computed(() => categoryComparisonDisplay(!this.isAllProjects(), this.hasProjects()));
  readonly baselineHasData = computed(() => baselineHasTickets(this.findCohort('baseline')));

  // Solo la cohorte con revision tiene desglose por resultado
  readonly outcomeRows = computed(() => {
    const data = this.data();
    const reviewed = data?.cohorts.find((cohort) => cohort.cohort === 'reviewed');
    return data && reviewed ? buildOutcomeRows(reviewed.outcomes, data.min_sample) : [];
  });

  private readonly defaultRange = defaultMetricsDayRange();
  private readonly retry$ = new Subject<void>();

  constructor() {
    // Los umbrales traen id, clave y nombre de cada proyecto. Si la carga
    // falla no se bloquea la pantalla: queda solo "Todos los proyectos".
    const options$ = this.metricsService.getThresholds().pipe(
      catchError(() => of<ProjectThresholdsItem[]>([])),
      map((projects) => buildProjectOptions(projects)),
      tap((options) => {
        this.projectOptions.set(options);
        this.optionsReady.set(true);
      }),
    );

    // decision no se lee: el filtro no aplica a esta pestaña, y que cambie
    // en la URL no tiene que volver a pedir los datos.
    const params$ = this.route.queryParamMap.pipe(
      map((params) => ({
        project: params.get('project'),
        from: params.get('from'),
        to: params.get('to'),
        category: params.get('category'),
      })),
      distinctUntilChanged(
        (a, b) => a.project === b.project && a.from === b.from && a.to === b.to && a.category === b.category,
      ),
    );

    combineLatest([params$, options$, this.retry$.pipe(startWith(undefined))])
      .pipe(
        switchMap(([params, options]) => {
          const selection = resolveProjectSelection(
            params.project,
            options.map((option) => option.projectId),
          );
          const range = resolveDateRange(params.from, params.to, this.defaultRange);
          const category = resolveMetricsFilters(params.category, null).category;

          this.selection.set(selection);
          this.state.set('loading');

          return this.metricsService
            .getResponseTimes(range.from, range.to, METRICS_TIMEZONE, buildResponseTimesFilters(selection, category))
            .pipe(
              tap((data) => {
                this.data.set(data);
                this.state.set(hasAnyTickets(data) ? 'loaded' : 'empty');
              }),
              catchError((error) => {
                this.data.set(null);
                this.errorMessage.set(responseTimesErrorMessage(error));
                this.state.set('error');
                return EMPTY;
              }),
            );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  private buildCards(keys: readonly string[]) {
    const data = this.data();
    if (!data) return [];
    return pickCohorts(data.cohorts, keys).map((cohort) =>
      buildCohortCard(cohort, data.min_sample, data.first_response_target_seconds),
    );
  }

  onClosureToggle(checked: boolean): void {
    this.showClosure.set(checked);
  }

  onProjectChange(value: string): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { project: value },
      queryParamsHandling: 'merge',
    });
  }

  retry(): void {
    this.retry$.next();
  }
}
