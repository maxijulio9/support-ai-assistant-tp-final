import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { InteractionListItem } from '../../../api/models/interaction-list-item';
import { formatShortDate } from '../../../shared/format-short-date';
import { confidencePercentText } from '../case-grouping';
import { DecisionChipComponent } from '../decision-chip.component';

// Las interacciones de un caso, la mas reciente primero. Cada una abre su detalle.
@Component({
  selector: 'app-case-interactions',
  standalone: true,
  imports: [RouterLink, DecisionChipComponent],
  templateUrl: './case-interactions.component.html',
  styleUrl: './case-interactions.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CaseInteractionsComponent {
  readonly issueKey = input.required<string>();
  readonly interactions = input.required<InteractionListItem[]>();

  readonly formatDate = formatShortDate;
  readonly confidenceText = confidencePercentText;
}
