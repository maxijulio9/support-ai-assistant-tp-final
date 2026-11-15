import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { InteractionDetailResponse } from '../../../api/models/interaction-detail-response';
import { formatShortDate } from '../../../shared/format-short-date';
import { safeTicketUrl } from '../../../shared/safe-ticket-url';
import { RESPONSE_TIME_LABEL, responseTimeText } from '../interaction-timing';

// Tres datos de un vistazo: el ticket, cuando se registro la interaccion y,
// si respondio el sistema solo, cuanto tardo
@Component({
  selector: 'app-detail-cards',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './detail-cards.component.html',
  styleUrl: './detail-cards.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DetailCardsComponent {
  readonly data = input.required<InteractionDetailResponse>();

  readonly ticketUrl = computed(() => safeTicketUrl(this.data().ticket_url));
  readonly createdText = computed(() => formatShortDate(this.data().created_at) || 'No registrada');
  readonly responseTime = computed(() => responseTimeText(this.data()));
  readonly responseTimeLabel = RESPONSE_TIME_LABEL;
}
