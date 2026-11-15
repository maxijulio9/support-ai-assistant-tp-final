import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { InteractionDetailResponse } from '../../../api/models/interaction-detail-response';
import { buildTimeline } from '../interaction-timing';

// Hitos de la interaccion con fecha, en orden. Sin ninguno no se muestra.
@Component({
  selector: 'app-interaction-timeline',
  standalone: true,
  templateUrl: './interaction-timeline.component.html',
  styleUrl: './interaction-timeline.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InteractionTimelineComponent {
  readonly data = input.required<InteractionDetailResponse>();

  readonly events = computed(() => buildTimeline(this.data()));
}
