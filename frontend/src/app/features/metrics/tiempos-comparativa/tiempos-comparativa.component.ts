import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { EMPTY, Subject, catchError, combineLatest, distinctUntilChanged, forkJoin, map, of, startWith, switchMap, tap } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MetricsService } from '../metrics.service';
import { ConfigService } from '../../config/config.service';
import { METRICS_TIMEZONE, defaultMetricsDayRange, resolveDateRange } from '../../dashboard/period';
import { resolveMetricsFilters } from '../metrics-filters';
import { OnboardedProject } from '../../../api/models/onboarded-project';
import { ProjectThresholdsItem } from '../../../api/models/project-thresholds-item';
import { hasAnyTickets } from './cohort-card';
import { ProjectOption, buildProjectOptions } from './project-options';
import {
  RESPONSE_TIMES_ERROR_MESSAGE,
  ResponseTimesUnavailableError,
  responseTimesErrorMessage,
} from './response-times-error';
import { ALL_PROJECTS, buildResponseTimesFilters, resolveProjectSelection } from './response-times-filters';
import { cohortLabel, firstResponseKindLabel, formatDuration } from './response-times-format';
import { ResponseTimesLike } from './response-times.types';

export type TiemposState = 'loading' | 'error' | 'empty' | 'loaded';

@Component({
  selector: 'app-metrics-tiempos-comparativa',
  standalone: true,
  imports: [MatButtonModule, MatFormFieldModule, MatIconModule, MatSelectModule],
  templateUrl: './tiempos-comparativa.component.html',
  styleUrl: './tiempos-comparativa.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TiemposComparativaComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly metricsService = inject(MetricsService);
  private readonly configService = inject(ConfigService);
  private readonly destroyRef = inject(DestroyRef);

  readonly allProjectsValue = ALL_PROJECTS;
  readonly baselineLabel = cohortLabel('baseline');

  readonly state = signal<TiemposState>('loading');
  readonly optionsReady = signal(false);
  readonly projectOptions = signal<ProjectOption[]>([]);
  readonly selection = signal<string>(ALL_PROJECTS);
  readonly data = signal<ResponseTimesLike | null>(null);
  readonly errorMessage = signal<string>(RESPONSE_TIMES_ERROR_MESSAGE);
  // El error local de endpoint no disponible no mejora al reintentar
  readonly canRetry = signal(true);

  readonly hasProjects = computed(() => this.projectOptions().length > 0);
  readonly isAllProjects = computed(() => this.selection() === ALL_PROJECTS);
  readonly targetText = computed(() => {
    const target = this.data()?.first_response_target_seconds;
    return target === null || target === undefined ? null : formatDuration(target);
  });

  // Resumen provisorio de lo cargado, hasta que lleguen las tarjetas
  readonly cohortSummary = computed(() =>
    (this.data()?.cohorts ?? []).map((cohort) => ({
      key: cohort.cohort,
      label: cohortLabel(cohort.cohort),
      kind: firstResponseKindLabel(cohort.first_response_kind),
      tickets: cohort.tickets,
    })),
  );

  private readonly defaultRange = defaultMetricsDayRange();
  private readonly retry$ = new Subject<void>();

  constructor() {
    // Los umbrales dan los ids y la lista de proyectos configurados los
    // nombres. Si alguna falla no se bloquea la pantalla: sin umbrales queda
    // solo "Todos", y sin nombres se usa el rotulo corto del id.
    const options$ = forkJoin([
      this.metricsService.getThresholds().pipe(catchError(() => of<ProjectThresholdsItem[]>([]))),
      this.configService.listOnboardedProjects().pipe(catchError(() => of<OnboardedProject[] | null>(null))),
    ]).pipe(
      map(([thresholds, onboarded]) =>
        buildProjectOptions(
          thresholds.map((item) => item.project_id),
          onboarded,
        ),
      ),
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
                this.canRetry.set(!(error instanceof ResponseTimesUnavailableError));
                this.state.set('error');
                return EMPTY;
              }),
            );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
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
