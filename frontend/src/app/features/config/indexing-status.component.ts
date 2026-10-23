import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subscription, interval } from 'rxjs';
import { ConfigService } from './config.service';
import { classifyFormError } from '../../shared/form-error';
import { IndexingStatusResponse } from '../../api/models/indexing-status-response';
import { StartIndexingResponse } from '../../api/models/start-indexing-response';
import {
  buildOptimisticIndexingStatus,
  formatIndexingTimestamp,
  hasNoIndexingData,
  indexingStatusLabel,
  indexingStatusTone,
  truncatedErrorDetail,
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

  // Tope alcanzado sin llegar a un estado terminal.
  readonly pollingTimedOut = signal(false);

  // Se reinicia cuando cambia la corrida mostrada (id distinto), para no
  // dejar expandido el detalle de una corrida vieja al mostrar otra.
  readonly errorExpanded = signal(false);
  private lastSeenRunId: string | null = null;

  readonly isInProgress = computed(() => {
    const status = this.status();
    return status !== null && (status.status === 'running' || status.status === 'queued');
  });

  readonly statusLabel = computed(() => {
    const status = this.status();
    return status ? indexingStatusLabel(status) : '';
  });

  readonly statusTone = computed(() => indexingStatusTone(this.status()));

  // Nota corta para dejar en claro que completed no confirma un resultado
  // correcto, solo que el worker termino sin error.
  readonly showCompletedNote = computed(() => this.status()?.status === 'completed');

  // En failed, los contadores indican hasta donde llego la corrida, no lo
  // que quedo guardado. No se muestra si ya se esta mostrando "Sin datos"
  // (corridas viejas, sin contadores que interpretar).
  readonly showFailedCountersNote = computed(() => {
    const status = this.status();
    return status !== null && status.status === 'failed' && !hasNoIndexingData(status);
  });

  readonly updatedAtLabel = computed(() => (this.isInProgress() ? 'Actualizado' : 'Finalizó'));

  readonly updatedAtDisplay = computed(() => {
    const status = this.status();
    if (!status || this.isInProgress()) return '-';
    return formatIndexingTimestamp(status.updated_at);
  });

  // Corridas viejas, de antes de registrar estos datos: en vez de "0" (que
  // sugeriria que no se proceso nada), se muestra como "Sin datos".
  readonly showNoDataLabel = computed(() => {
    const status = this.status();
    return status !== null && hasNoIndexingData(status);
  });

  readonly errorPreview = computed(() => {
    const detail = this.status()?.error_detail;
    if (!detail) return null;
    return { full: detail, ...truncatedErrorDetail(detail) };
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

  toggleErrorExpanded(): void {
    this.errorExpanded.update((value) => !value);
  }

  // Lo llama el padre justo despues de un start exitoso. La fila de la
  // corrida nueva ya existe al responder el POST, asi que se muestra de
  // una con lo que trae esa respuesta, y enseguida se pide el GET real.
  notifyStarted(response: StartIndexingResponse, spaceKeys: string[]): void {
    this.pollingTimedOut.set(false);
    this.applyStatus(buildOptimisticIndexingStatus(response, spaceKeys));
    this.state.set('loaded');
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
            this.status.set(null);
            this.state.set('empty');
            return;
          }
          // un fallo pasajero durante un ciclo silencioso no debe tapar el
          // panel que ya se esta mostrando; el proximo ciclo lo reintenta.
          if (silent) return;
          this.stopPolling();
          const result = classifyFormError(error);
          this.loadErrorMessage.set(result.message ?? GENERIC_ERROR_MESSAGE);
          this.state.set('error');
        },
      });
  }

  // Lo que devuelve el GET siempre se muestra tal cual, sea la misma
  // corrida, una mas nueva, o cualquier otra: no hay ninguna comparacion
  // contra un estado anterior.
  private handleStatus(status: IndexingStatusResponse): void {
    this.applyStatus(status);
    this.state.set('loaded');

    if (status.status === 'running' || status.status === 'queued') {
      this.ensurePolling();
    } else {
      this.stopPolling();
    }
  }

  private applyStatus(status: IndexingStatusResponse): void {
    if (status.id !== this.lastSeenRunId) {
      this.errorExpanded.set(false);
    }
    this.lastSeenRunId = status.id;
    this.status.set(status);
  }

  // Tope generico de "no pollear para siempre": sin relacion con detectar
  // una corrida nueva. Al cortarse, el boton "Actualizar estado" del
  // encabezado sigue disponible para consultar a mano.
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
