import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { formatRelativeTime } from '../../../shared/format-relative-time';
import { safeTicketUrl } from '../../../shared/safe-ticket-url';
import {
  CaseGroup,
  POSSIBLY_INCOMPLETE_DETAIL,
  POSSIBLY_INCOMPLETE_LABEL,
  interactionsCountText,
  isSingleInteraction,
} from '../case-grouping';
import { CaseInteractionsComponent } from '../case-interactions/case-interactions.component';
import { DecisionChipComponent } from '../decision-chip.component';

// Una fila por ticket. Los casos con varias interacciones se expanden; los de
// una sola son planos y abren el detalle directo.
@Component({
  selector: 'app-case-table',
  standalone: true,
  imports: [RouterLink, MatIconModule, CaseInteractionsComponent, DecisionChipComponent],
  templateUrl: './case-table.component.html',
  styleUrl: './case-table.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CaseTableComponent {
  readonly cases = input.required<CaseGroup[]>();

  // Quien manda es la pantalla, que guarda los casos abiertos en la URL
  readonly expanded = input<readonly string[]>([]);
  readonly toggled = output<string>();

  readonly isExpanded = computed(() => {
    const open = new Set(this.expanded());
    return (issueKey: string) => open.has(issueKey);
  });

  readonly incompleteLabel = POSSIBLY_INCOMPLETE_LABEL;
  readonly incompleteDetail = POSSIBLY_INCOMPLETE_DETAIL;
  readonly relativeTime = formatRelativeTime;
  readonly safeTicketUrl = safeTicketUrl;
  readonly isSingle = isSingleInteraction;
  readonly countText = interactionsCountText;

  toggle(issueKey: string): void {
    this.toggled.emit(issueKey);
  }
}
