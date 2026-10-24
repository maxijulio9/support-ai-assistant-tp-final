import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { EMPTY, Subject, catchError, switchMap } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { InteractionsService } from './interactions.service';
import { DecisionStatus, decisionStatus } from './interaction-status';
import { resolutionChannelLabel } from './resolution-channel';
import { safeTicketUrl } from '../../shared/safe-ticket-url';
import { formatShortDate } from '../../shared/format-short-date';
import { InteractionDetailResponse } from '../../api/models/interaction-detail-response';

export type DetailViewState = 'loading' | 'error' | 'not-found' | 'loaded';

// Valida la forma del UUID, no su existencia. Evita pedirle al backend un id
// que ya sabemos mal formado.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Component({
  selector: 'app-interaction-detail',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, RouterLink],
  templateUrl: './interaction-detail.component.html',
  styleUrl: './interaction-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InteractionDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly interactionsService = inject(InteractionsService);
  private readonly destroyRef = inject(DestroyRef);

  // read: ElementRef porque el h1 nativo necesita .focus(); ver el mismo
  // caso resuelto en regenerate-dialog.component.ts con #entendidoButton.
  private readonly heading = viewChild('heading', { read: ElementRef<HTMLElement> });

  readonly state = signal<DetailViewState>('loading');
  readonly detail = signal<InteractionDetailResponse | null>(null);

  private readonly load$ = new Subject<string>();

  readonly confidencePercent = computed(() => {
    const score = this.detail()?.confidence_score;
    if (score === null || score === undefined) return null;
    return Math.min(100, Math.max(0, Math.round(score * 100)));
  });

  readonly safeTicketUrl = safeTicketUrl;
  readonly formatDate = formatShortDate;
  readonly resolutionChannelLabel = resolutionChannelLabel;

  constructor() {
    // route.paramMap emite el id actual de forma sincrona al suscribirse.
    // El pipeline de load$ tiene que estar suscripto ANTES de esa
    // suscripcion: load$ es un Subject sin replay, asi que si paramMap
    // emite primero, esa emision sincrona se pierde y la pantalla queda
    // en "loading" para siempre.
    this.load$
      .pipe(
        switchMap((id) => {
          if (!UUID_PATTERN.test(id)) {
            this.state.set('not-found');
            this.detail.set(null);
            return EMPTY;
          }
          this.state.set('loading');
          return this.interactionsService.getDetail(id).pipe(
            catchError((error: unknown) => {
              this.detail.set(null);
              this.state.set(error instanceof HttpErrorResponse && error.status === 404 ? 'not-found' : 'error');
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((detail) => {
        this.detail.set(detail);
        this.state.set('loaded');
      });

    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = params.get('id');
      if (id) this.load$.next(id);
    });

    // Al pasar a loaded, se mueve el foco al h1 para que el lector de
    // pantalla anuncie el contenido nuevo (mismo patron que el foco del
    // dialogo de regenerar).
    effect(() => {
      if (this.state() !== 'loaded') return;
      this.heading()?.nativeElement.focus();
    });
  }

  retry(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) this.load$.next(id);
  }

  statusFor(decision: string | null): DecisionStatus {
    return decisionStatus(decision);
  }
}
