import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { InteractionDetailResponse } from '../../api/models/interaction-detail-response';
import { safeTicketUrl } from '../../shared/safe-ticket-url';

export type DetailState = 'empty' | 'loading' | 'error' | 'loaded';

@Component({
  selector: 'app-review-detail',
  standalone: true,
  imports: [MatButtonModule, MatTooltipModule],
  templateUrl: './review-detail.component.html',
  styleUrl: './review-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReviewDetailComponent {
  readonly detail = input<InteractionDetailResponse | null>(null);
  readonly state = input<DetailState>('empty');
  readonly submitting = input(false);

  readonly approve = output<void>();
  readonly regenerate = output<void>();
  readonly retry = output<void>();

  formattedCreatedAt(createdAt: string | null | undefined): string {
    if (!createdAt) return '';
    const date = new Date(createdAt);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('es', { dateStyle: 'long', timeStyle: 'short' });
  }

  readonly safeTicketUrl = safeTicketUrl;
}
