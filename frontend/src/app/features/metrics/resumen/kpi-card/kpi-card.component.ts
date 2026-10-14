import { ChangeDetectionStrategy, Component, input } from '@angular/core';

// Presentacional puro: recibe texto ya formateado, no sabe de donde sale el
// numero ni que significa la suba o la baja para cada metrica en particular.
@Component({
  selector: 'app-metrics-kpi-card',
  standalone: true,
  templateUrl: './kpi-card.component.html',
  styleUrl: './kpi-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KpiCardComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly deltaText = input<string | null>(null);
  readonly deltaArrowUp = input(true);
  readonly deltaBad = input(false);
  readonly highlight = input(false);
}
