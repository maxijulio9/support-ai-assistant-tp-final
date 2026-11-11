import { ChangeDetectionStrategy, Component, input, linkedSignal, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { InteractionDetailResponse } from '../../api/models/interaction-detail-response';
import { InteractionSourcesComponent } from '../interactions/interaction-sources.component';
import { isSourcesFoldable, sourcesToggleTitle } from './review-sources';
import { safeTicketUrl } from '../../shared/safe-ticket-url';
import { generatedAtText } from '../interactions/review-info';
import { RESPONDED_AT_LABEL, respondedAtText } from '../interactions/responded-at';

export type DetailState = 'empty' | 'loading' | 'error' | 'loaded';

@Component({
  selector: 'app-review-detail',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, InteractionSourcesComponent],
  templateUrl: './review-detail.component.html',
  styleUrl: './review-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReviewDetailComponent {
  readonly detail = input<InteractionDetailResponse | null>(null);
  readonly state = input<DetailState>('empty');
  readonly submitting = input(false);

  // Cerrado por defecto; al cambiar de solicitud vuelve a cerrarse
  readonly sourcesOpen = linkedSignal<string | undefined, boolean>({
    source: () => this.detail()?.issue_key,
    computation: () => false,
  });

  readonly sourcesTitle = sourcesToggleTitle;
  readonly sourcesFoldable = isSourcesFoldable;

  toggleSources(): void {
    this.sourcesOpen.update((open) => !open);
  }

  readonly approve = output<void>();
  readonly regenerate = output<void>();
  readonly discard = output<void>();
  readonly editApprove = output<void>();
  readonly retry = output<void>();

  formattedCreatedAt(createdAt: string | null | undefined): string {
    if (!createdAt) return '';
    const date = new Date(createdAt);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('es', { dateStyle: 'long', timeStyle: 'short' });
  }

  readonly safeTicketUrl = safeTicketUrl;
  readonly respondedAtLabel = RESPONDED_AT_LABEL;
  readonly respondedAtText = respondedAtText;
  readonly generatedAtText = generatedAtText;
}
