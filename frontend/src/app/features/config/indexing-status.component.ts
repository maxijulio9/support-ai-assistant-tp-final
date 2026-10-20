import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subscription, interval } from 'rxjs';
import { ConfigService } from './config.service';
import { classifyFormError } from '../../shared/form-error';
import { IndexingStatusResponse } from '../../api/models/indexing-status-response';
import {
  formatIndexingTimestamp,
  indexingStatusLabel,
  indexingStatusTone,
  isOrphanedIndexingStatus,
} from './indexing-status-display';

export type IndexingStatusState = 'loading' | 'error' | 'empty' | 'loaded';

const GENERIC_ERROR_MESSAGE = 'Ocurrió un error inesperado. Intentá de nuevo.';
const POLL_INTERVAL_MS = 3000;
const MAX_POLL_DURATION_MS = 5 * 60 * 1000;

@Component({
  selector: 'app-indexing-status',
  standalone: true,
  imports: [MatButtonModule, MatProgressSpinnerModule],
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

  // El status /api/indexing/status devuelve la corrida anterior hasta que el
  // worker crea la nueva, y no hay un id de corrida para distinguirlas. Tras
  // un start exitoso estos dos signals cubren esa ventana: se sigue
  // polleando sin aplicar la logica normal hasta ver un started_at mas
  // nuevo que el guardado antes del POST.
  readonly awaitingNewRun = signal(false);
  readonly awaitingTimedOut = signal(false);
  // Tope alcanzado con la corrida nueva ya detectada (sigue running).
  readonly pollingTimedOut = signal(false);

  private baselineStartedAt: string | null = null;

  readonly isInProgress = computed(() => {
    if (this.awaitingNewRun()) return true;
    const status = this.status();
    return status !== null && status.status === 'running' && !isOrphanedIndexingStatus(status);
  });

  readonly isOrphaned = computed(() => {
    if (this.awaitingNewRun()) return false;
    const status = this.status();
    return status !== null && isOrphanedIndexingStatus(status);
  });

  readonly statusLabel = computed(() => {
    if (this.awaitingNewRun()) return 'Iniciando...';
    // null solo puede pasar antes del primer load, que esta pantalla nunca
    // llega a renderizar (el chip vive dentro de @if (state() === 'loaded')).
    const status = this.status();
    return status ? indexingStatusLabel(status) : '';
  });

  readonly statusTone = computed(() =>
    this.awaitingNewRun() ? 'progress' : indexingStatusTone(this.status()),
  );

  // Nota corta para dejar en claro que completed no confirma un resultado
  // correcto, solo que el worker termino sin error.
  readonly showCompletedNote = computed(
    () => !this.awaitingNewRun() && this.status()?.status === 'completed',
  );

  readonly updatedAtLabel = computed(() => {
    const status = this.status();
    return status && status.status !== 'running' ? 'Finalizó' : 'Actualizado';
  });

  readonly updatedAtDisplay = computed(() => {
    const status = this.status();
    if (!status || status.status === 'running') return '-';
    return formatIndexingTimestamp(status.updated_at);
  });

  // Completed con los dos contadores en 0 es un resultado valido (por
  // ejemplo un espacio sin contenido nuevo), no "no se indexo nada": se
  // muestra con un guion en vez de "0" para no sugerir lo segundo.
  readonly showCountersAsDash = computed(() => {
    const status = this.status();
    return (
      status !== null &&
      status.status === 'completed' &&
      status.documents_processed === 0 &&
      status.chunks_generated === 0
    );
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

  // Lo llama el padre justo despues de un start exitoso. El estado actual
  // (si existia) todavia no se toco desde antes del POST, asi que leerlo
  // aca equivale a guardarlo "antes" de iniciar la corrida nueva.
  notifyStarted(): void {
    this.baselineStartedAt = this.status()?.started_at ?? null;
    this.awaitingNewRun.set(true);
    this.awaitingTimedOut.set(false);
    this.pollingTimedOut.set(false);
    this.fetchStatus();
  }

  formatTimestamp(value: string): string {
    return formatIndexingTimestamp(value);
  }

  // Silencioso cuando ya hay algo cargado: ni el polling ni un refresh
  // manual posterior al primer load deben tapar el panel con un esqueleto,
  // los datos se actualizan en el lugar.
  private fetchStatus(): void {
    const silent = this.state() === 'loaded';

    if (!silent) {
      this.state.set('loading');
      this.loadErrorMessage.set(null);
    }

    this.configService
      .getIndexingStatus()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (status) => this.handleStatus(status),
        error: (error: unknown) => {
          if (error instanceof HttpErrorResponse && error.status === 404) {
            this.stopPolling();
            this.awaitingNewRun.set(false);
            this.status.set(null);
            this.state.set('empty');
            return;
          }
          // un fallo pasajero durante un ciclo silencioso no debe tapar el
          // panel que ya se esta mostrando; el proximo ciclo lo reintenta.
          if (silent) return;
          this.stopPolling();
          this.awaitingNewRun.set(false);
          const result = classifyFormError(error);
          this.loadErrorMessage.set(result.message ?? GENERIC_ERROR_MESSAGE);
          this.state.set('error');
        },
      });
  }

  private handleStatus(status: IndexingStatusResponse): void {
    this.status.set(status);
    this.state.set('loaded');

    if (this.awaitingNewRun()) {
      const isNewRun = this.baselineStartedAt === null || this.isNewer(status.started_at, this.baselineStartedAt);
      if (!isNewRun) {
        // sigue siendo la corrida vieja: no se aplica la logica normal
        // todavia, solo se sigue esperando con el mismo intervalo.
        this.ensurePolling();
        return;
      }
      this.awaitingNewRun.set(false);
      this.awaitingTimedOut.set(false);
      // nueva ventana de 5 minutos para seguir esta corrida recien detectada.
      this.pollDeadline = Date.now() + MAX_POLL_DURATION_MS;
    }

    if (status.status === 'running' && !isOrphanedIndexingStatus(status)) {
      this.ensurePolling();
    } else {
      this.stopPolling();
    }
  }

  private isNewer(candidate: string, baseline: string): boolean {
    return new Date(candidate).getTime() > new Date(baseline).getTime();
  }

  private ensurePolling(): void {
    if (this.pollSubscription) return;

    this.pollDeadline = Date.now() + MAX_POLL_DURATION_MS;

    this.pollSubscription = interval(POLL_INTERVAL_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (Date.now() >= this.pollDeadline) {
          const wasAwaiting = this.awaitingNewRun();
          this.stopPolling();
          if (wasAwaiting) {
            this.awaitingTimedOut.set(true);
          } else {
            this.pollingTimedOut.set(true);
          }
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
