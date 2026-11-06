import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { NgxEchartsDirective } from 'ngx-echarts';
import type { EChartsCoreOption } from 'echarts/core';
import { resolveThemeColor, resolveThemeColorRgba } from '../../../../shared/decision-colors';
import { HelpText } from '../../../../shared/help-texts';
import { InfoHintComponent } from '../../../../shared/info-hint/info-hint.component';
import { DeltaView } from '../../../../shared/kpi-metrics';
import { MiniChart, MiniMetric, miniTooltip } from '../kpi-mini-chart';

const CHART_FONT_SIZE = 14;
// Con muchos dias los puntos se achican para que la linea siga leyendose
const MANY_POINTS = 31;

// Tokens de cada tarjeta: linea y puntos (con contraste) y degradado del
// relleno (decorativo)
const CHART_TOKENS: Record<MiniMetric, { line: string; top: string; bottom: string }> = {
  'auto-publish': { line: '--app-spark-line-teal', top: '--app-spark-auto-top', bottom: '--app-spark-auto-bottom' },
  escalate: { line: '--app-spark-line-violet', top: '--app-spark-escalate-top', bottom: '--app-spark-escalate-bottom' },
  total: { line: '--app-spark-line-teal', top: '--app-spark-total-top', bottom: '--app-spark-total-bottom' },
  confidence: { line: '--app-spark-line-violet', top: '--app-spark-confidence-top', bottom: '--app-spark-confidence-bottom' },
};

// Presentacional puro: recibe el valor y el delta ya preparados (formatDelta),
// no sabe de donde sale el numero ni que significa la suba o la baja para
// cada metrica en particular.
@Component({
  selector: 'app-metrics-kpi-card',
  standalone: true,
  imports: [NgxEchartsDirective, InfoHintComponent],
  templateUrl: './kpi-card.component.html',
  styleUrl: './kpi-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KpiCardComponent {
  private readonly destroyRef = inject(DestroyRef);

  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly delta = input<DeltaView | null>(null);
  readonly highlight = input(false);

  // Minigrafico por dia; null si no hay datos o no se pudieron cargar
  readonly chart = input<MiniChart | null>(null);

  // Fuerza a recalcular las opciones cuando cambia el esquema de color del
  // sistema operativo (mismo mecanismo que los demas graficos).
  private readonly colorSchemeTick = signal(0);

  // Texto del icono de informacion junto al titulo; sin texto no hay icono
  readonly help = input<HelpText | null>(null);

  readonly chartOptions = computed<EChartsCoreOption>(() => {
    this.colorSchemeTick();
    const chart = this.chart();
    if (!chart) return {};

    const tokens = CHART_TOKENS[chart.metric];
    const line = resolveThemeColor(tokens.line);
    const surface = resolveThemeColor('--mat-sys-surface-container-lowest');
    const crowded = chart.points.length > MANY_POINTS;

    return {
      grid: { left: 8, right: 8, top: 8, bottom: 4 },
      xAxis: { type: 'category', show: false, data: chart.points.map((point) => point.label) },
      // El eje se ajusta a los datos de esta tarjeta, con margen
      yAxis: { type: 'value', show: false, min: chart.yMin, max: chart.yMax },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'line' },
        textStyle: { fontSize: CHART_FONT_SIZE },
        confine: true,
        formatter: (params: unknown) => {
          const first = Array.isArray(params) ? (params[0] as { dataIndex?: number } | undefined) : undefined;
          return first?.dataIndex === undefined ? '' : miniTooltip(chart, first.dataIndex);
        },
      },
      series: [
        {
          type: 'line',
          smooth: true,
          // Une solo los dias con dato: el dia sin dato no baja a cero
          connectNulls: true,
          data: chart.points.map((point) => point.value),
          symbol: 'circle',
          // Todos los puntos marcados, sin que echarts oculte los que se pisan
          showAllSymbol: true,
          symbolSize: crowded ? 4 : 7,
          lineStyle: { color: line, width: 2 },
          itemStyle: { color: line, borderColor: surface, borderWidth: crowded ? 0 : 1.5 },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: resolveThemeColorRgba(tokens.top) },
                { offset: 1, color: resolveThemeColorRgba(tokens.bottom) },
              ],
            },
          },
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
