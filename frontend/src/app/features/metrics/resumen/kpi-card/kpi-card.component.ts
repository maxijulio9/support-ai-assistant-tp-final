import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { NgxEchartsDirective } from 'ngx-echarts';
import type { EChartsCoreOption } from 'echarts/core';
import { sparklineTrend } from '../../sparkline-trend';

// El canvas de echarts no puede resolver var(--token) solo, hace falta el
// color literal, leido en runtime (mismo patron que el resto de los graficos
// de Metricas).
function resolveSparklineColor(): string {
  return getComputedStyle(document.documentElement).getPropertyValue('--mat-sys-primary').trim();
}

// Presentacional puro: recibe texto ya formateado, no sabe de donde sale el
// numero ni que significa la suba o la baja para cada metrica en particular.
@Component({
  selector: 'app-metrics-kpi-card',
  standalone: true,
  imports: [NgxEchartsDirective],
  templateUrl: './kpi-card.component.html',
  styleUrl: './kpi-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KpiCardComponent {
  private readonly destroyRef = inject(DestroyRef);

  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly deltaText = input<string | null>(null);
  readonly deltaArrowUp = input(true);
  readonly deltaColored = input(false);
  readonly deltaBad = input(false);
  readonly highlight = input(false);

  // Serie diaria del minigrafico: null es un dia sin datos (hueco), no un
  // cero. Vacio por defecto, asi un KpiCardComponent sin este input no
  // cambia de comportamiento.
  readonly sparklineValues = input<(number | null)[]>([]);

  // Fuerza a recalcular sparklineOptions cuando cambia el esquema de color
  // del sistema operativo (mismo mecanismo que los demas graficos).
  private readonly colorSchemeTick = signal(0);

  readonly trendLabel = computed(() => sparklineTrend(this.sparklineValues()));

  readonly sparklineOptions = computed<EChartsCoreOption>(() => {
    this.colorSchemeTick();
    const color = resolveSparklineColor();

    return {
      grid: { left: 0, right: 0, top: 4, bottom: 4 },
      xAxis: { type: 'category', show: false, data: this.sparklineValues().map((_, index) => index) },
      yAxis: { type: 'value', show: false },
      series: [
        {
          type: 'line',
          data: this.sparklineValues(),
          connectNulls: false,
          showSymbol: true,
          symbolSize: 4,
          lineStyle: { color, width: 1.5 },
          itemStyle: { color },
        },
      ],
    };
  });

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
  }
}
