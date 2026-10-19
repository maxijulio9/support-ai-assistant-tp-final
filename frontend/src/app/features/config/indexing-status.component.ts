import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { Subscription, interval } from 'rxjs';
import { ConfigService } from './config.service';
import { classifyFormError } from '../../shared/form-error';
import { IndexingStatusResponse } from '../../api/models/indexing-status-response';

export type IndexingStatusState = 'loading' | 'error' | 'empty' | 'loaded';

const GENERIC_ERROR_MESSAGE = 'Ocurrió un error inesperado. Intentá de nuevo.';
const POLL_INTERVAL_MS = 3000;
const MAX_POLL_DURATION_MS = 5 * 60 * 1000;
const IN_PROGRESS_STATUSES = new Set(['queued', 'running']);

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' });
}

@Component({
  selector: 'app-indexing-status',
  standalone: true,
  imports: [MatButtonModule],
  templateUrl: './indexing-status.component.html',
  styleUrl: './indexing-status.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IndexingStatusComponent {
  private readonly configService = inject(ConfigService);
  private readonly destroyRef = inject(DestroyRef);

  readonly state = signal<IndexingStatusState>('loading');
  readonly loadErrorMessage = signal<string | null>(null);
  readonly status = signal<IndexingStatusResponse | null>(null);
  readonly pollingTimedOut = signal(false);

  readonly isInProgress = computed(() => {
    const status = this.status();
    return status !== null && IN_PROGRESS_STATUSES.has(status.status);
  });

  private pollSubscription: Subscription | null = null;
  private pollDeadline = 0;

  constructor() {
    this.fetchStatus();
    this.destroyRef.onDestroy(() => this.stopPolling());
  }

  refresh(): void {
    this.fetchStatus();
  }

  // Lo llama el padre justo despues de un start exitoso, para no esperar el
  // primer tick del intervalo antes de ver el estado "queued".
  notifyStarted(): void {
    this.pollingTimedOut.set(false);
    this.fetchStatus();
  }

  statusTone(status: string): 'progress' | 'success' | 'error' | 'neutral' {
    if (IN_PROGRESS_STATUSES.has(status)) return 'progress';
    if (status === 'completed') return 'success';
    if (status === 'failed') return 'error';
    return 'neutral';
  }

  formatTimestamp(value: string): string {
    return formatTimestamp(value);
  }

  private fetchStatus(): void {
    this.state.set('loading');
    this.loadErrorMessage.set(null);

    this.configService
      .getIndexingStatus()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (status) => {
          this.status.set(status);
          this.state.set('loaded');
          if (IN_PROGRESS_STATUSES.has(status.status)) {
            this.ensurePolling();
          } else {
            this.stopPolling();
          }
        },
        error: (error: unknown) => {
          this.stopPolling();
          if (error instanceof HttpErrorResponse && error.status === 404) {
            this.status.set(null);
            this.state.set('empty');
            return;
          }
          const result = classifyFormError(error);
          this.loadErrorMessage.set(result.message ?? GENERIC_ERROR_MESSAGE);
          this.state.set('error');
        },
      });
  }

  private ensurePolling(): void {
    if (this.pollSubscription) return;

    this.pollDeadline = Date.now() + MAX_POLL_DURATION_MS;

    this.pollSubscription = interval(POLL_INTERVAL_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (Date.now() >= this.pollDeadline) {
          this.stopPolling();
          this.pollingTimedOut.set(true);
          return;
        }
        this.fetchStatus();
      });
  }

  private stopPolling(): void {
    this.pollSubscription?.unsubscribe();
    this.pollSubscription = null;
  }
}
