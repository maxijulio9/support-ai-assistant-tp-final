import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { NgxEchartsDirective } from 'ngx-echarts';
import type { EChartsCoreOption } from 'echarts/core';
import { DecisionTone } from '../interactions/interaction-status';

export interface DonutSegment {
  label: string;
  value: number;
  tone: DecisionTone;
}

// Mapeo de tono a la custom property real: el canvas de echarts no puede
// resolver var(--token) solo, hace falta el color literal. Se lee en
// runtime (ver resolveToneColor) para no hardcodear ningun hex nuevo.
const TONE_CSS_VAR: Record<DecisionTone, string> = {
  success: '--app-color-success',
  warning: '--app-color-warning',
  error: '--mat-sys-error',
  neutral: '--app-color-text-secondary',
};

function resolveToneColor(tone: DecisionTone): string {
  return getComputedStyle(document.documentElement).getPropertyValue(TONE_CSS_VAR[tone]).trim();
}

@Component({
  selector: 'app-decisions-donut',
  standalone: true,
  imports: [DecimalPipe, NgxEchartsDirective],
  templateUrl: './decisions-donut.component.html',
  styleUrl: './decisions-donut.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DecisionsDonutComponent {
  private readonly destroyRef = inject(DestroyRef);

  readonly segments = input<DonutSegment[]>([]);
  readonly total = input(0);

  // Los colores no se cachean: resolveToneColor() se vuelve a leer cada vez
  // que options() se recalcula. colorSchemeTick fuerza ese recalculo cuando
  // cambia el esquema de color del sistema operativo, para que el canvas no
  // quede pintado con los valores del tema anterior. Hoy el tema esta fijo
  // en "light" (mat.theme({ color: { theme-type: 'light' } })), asi que este
  // listener no tiene efecto visible todavia, pero deja el mecanismo listo
  // para cuando haya un modo oscuro real.
  private readonly colorSchemeTick = signal(0);

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

  readonly options = computed<EChartsCoreOption>(() => {
    this.colorSchemeTick();

    return {
      tooltip: { trigger: 'item' },
      series: [
        {
          type: 'pie',
          radius: ['60%', '85%'],
          avoidLabelOverlap: false,
          label: { show: false },
          data: this.segments().map((segment) => ({
            name: segment.label,
            value: segment.value,
            itemStyle: { color: resolveToneColor(segment.tone) },
          })),
        },
      ],
    };
  });

  percentOf(value: number): string {
    const total = this.total();
    if (total <= 0) return '0.0';
    return ((value / total) * 100).toFixed(1);
  }
}
