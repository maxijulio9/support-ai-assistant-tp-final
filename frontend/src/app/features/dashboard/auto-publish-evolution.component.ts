import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Subject, catchError, map, startWith, switchMap } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { NgxEchartsDirective } from 'ngx-echarts';
import type { EChartsCoreOption } from 'echarts/core';
import { resolveThemeColor } from '../../shared/decision-colors';
import { MetricsService } from '../metrics/metrics.service';
import { METRICS_TIMEZONE } from './period';
import {
  DEFAULT_EVOLUTION_DAYS,
  EVOLUTION_DAY_OPTIONS,
  EvolutionDays,
  EvolutionPoint,
  buildEvolutionPoints,
  evolutionRange,
  evolutionSummary,
  dayTooltip,
  evolutionHeadline,
  evolutionPeriod,
  hasEvolutionData,
} from './auto-publish-evolution';

export type EvolutionState = 'loading' | 'error' | 'empty' | 'loaded';

const AXIS_FONT_SIZE = 14;

@Component({
  selector: 'app-auto-publish-evolution',
  standalone: true,
  imports: [MatButtonModule, MatButtonToggleModule, NgxEchartsDirective],
  templateUrl: './auto-publish-evolution.component.html',
  styleUrl: './auto-publish-evolution.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AutoPublishEvolutionComponent {
  private readonly metricsService = inject(MetricsService);
  private readonly destroyRef = inject(DestroyRef);

  readonly dayOptions = EVOLUTION_DAY_OPTIONS;
  // Independiente del selector de periodo del encabezado de Inicio
  readonly days = signal<EvolutionDays>(DEFAULT_EVOLUTION_DAYS);
  readonly state = signal<EvolutionState>('loading');
  readonly points = signal<EvolutionPoint[]>([]);

  readonly summary = computed(() => evolutionSummary(this.points()));
  readonly headline = computed(() => evolutionHeadline(evolutionPeriod(this.points()), this.days()));

  // El tema esta fijo en claro hoy; este contador deja listo el recalculo de
  // colores para cuando cambie el esquema del sistema (igual que el donut).
  private readonly colorSchemeTick = signal(0);
  private readonly request$ = new Subject<void>();

  readonly options = computed<EChartsCoreOption>(() => {
    this.colorSchemeTick();
    const points = this.points();
    const days = this.days();
    const line = resolveThemeColor('--app-chart-line');
    const neutral = resolveThemeColor('--app-chart-neutral');
    const edge = resolveThemeColor('--app-color-text-secondary');
    const grid = resolveThemeColor('--mat-sys-outline-variant');
    const surface = resolveThemeColor('--mat-sys-surface-container-lowest');

    // Un dia sin solicitudes es un hueco: null, no un 0 dibujado
    const column = (pick: (point: EvolutionPoint) => number) =>
      points.map((point) => (point.total === 0 ? null : pick(point)));

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        textStyle: { fontSize: AXIS_FONT_SIZE },
        formatter: (params: unknown) => {
          const first = Array.isArray(params) ? (params[0] as { dataIndex?: number } | undefined) : undefined;
          const point = first?.dataIndex === undefined ? undefined : points[first.dataIndex];
          return point ? dayTooltip(point) : '';
        },
      },
      grid: { left: 40, right: 8, top: 16, bottom: 32, containLabel: false },
      xAxis: {
        type: 'category',
        data: points.map((point) => point.label),
        axisTick: { show: false },
        // Con 30 dias se muestra una etiqueta cada 5 para que no se pisen
        axisLabel: { color: edge, fontSize: AXIS_FONT_SIZE, hideOverlap: true, interval: days === 30 ? 4 : 0 },
      },
      yAxis: {
        type: 'value',
        minInterval: 1,
        axisLabel: { color: edge, fontSize: AXIS_FONT_SIZE, formatter: '{value}' },
        splitLine: { lineStyle: { color: grid } },
      },
      series: [
        {
          name: 'Resueltas automáticamente',
          type: 'bar',
          stack: 'total',
          barMaxWidth: 32,
          itemStyle: { color: line },
          data: column((point) => point.autoPublish),
        },
        {
          name: 'Resto',
          type: 'bar',
          stack: 'total',
          barMaxWidth: 32,
          // Borde y trama ademas del gris: no depende solo del color
          itemStyle: {
            color: neutral,
            borderColor: edge,
            borderWidth: 1,
            decal: { symbol: 'rect', color: surface, dashArrayX: [1, 0], dashArrayY: [2, 4], rotation: Math.PI / 4 },
          },
          data: column((point) => point.rest),
        },
      ],
    };
  });

  constructor() {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      const onChange = () => this.colorSchemeTick.update((tick) => tick + 1);
      media.addEventListener('change', onChange);
      this.destroyRef.onDestroy(() => media.removeEventListener('change', onChange));
    }

    this.request$
      .pipe(
        startWith(undefined),
        switchMap(() => {
          this.state.set('loading');
          const range = evolutionRange(this.days());
          return this.metricsService.getDaily(range.from, range.to, METRICS_TIMEZONE).pipe(
            map((days) => buildEvolutionPoints(range, days)),
            catchError(() => {
              this.points.set([]);
              this.state.set('error');
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((points) => {
        this.points.set(points);
        this.state.set(hasEvolutionData(points) ? 'loaded' : 'empty');
      });
  }

  setDays(days: EvolutionDays): void {
    if (this.days() === days) return;
    this.days.set(days);
    this.request$.next();
  }

  retry(): void {
    this.request$.next();
  }
}
