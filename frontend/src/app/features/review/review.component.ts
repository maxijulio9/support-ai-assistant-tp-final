import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject, catchError, of, switchMap, tap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/auth/auth.service';
import { ReviewService, resolveReviewedBy } from './review.service';
import { classifyReviewError } from './review-errors';
import { ReviewQueueComponent, QueueState } from './review-queue.component';
import { ReviewDetailComponent, DetailState } from './review-detail.component';
import { RejectDialogComponent, RejectDialogData, RejectDialogResult } from './reject-dialog.component';
import { InteractionListItem } from '../../api/models/interaction-list-item';
import { InteractionDetailResponse } from '../../api/models/interaction-detail-response';

const PAGE_SIZE = 6;

@Component({
  selector: 'app-review',
  standalone: true,
  imports: [ReviewQueueComponent, ReviewDetailComponent],
  templateUrl: './review.component.html',
  styleUrl: './review.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReviewComponent {
  private readonly reviewService = inject(ReviewService);
  private readonly authService = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly queueState = signal<QueueState>('loading');
  readonly queueItems = signal<InteractionListItem[]>([]);
  readonly selectedId = signal<string | null>(null);
  readonly detailState = signal<DetailState>('empty');
  readonly detail = signal<InteractionDetailResponse | null>(null);
  readonly searchTerm = signal('');
  readonly priorityFilter = signal<string | null>(null);
  readonly page = signal(1);
  readonly submittingApprove = signal(false);

  private readonly selectionRequest$ = new Subject<string>();

  readonly filteredItems = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const priority = this.priorityFilter();
    return this.queueItems().filter((item) => {
      const matchesTerm =
        !term ||
        (item.summary ?? '').toLowerCase().includes(term) ||
        item.issue_key.toLowerCase().includes(term);
      const matchesPriority = !priority || item.priority === priority;
      return matchesTerm && matchesPriority;
    });
  });

  readonly totalPending = computed(() => this.queueItems().length);
  readonly totalFiltered = computed(() => this.filteredItems().length);
  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.totalFiltered() / PAGE_SIZE)));
  readonly pageItems = computed(() => {
    const start = (this.page() - 1) * PAGE_SIZE;
    return this.filteredItems().slice(start, start + PAGE_SIZE);
  });
  readonly priorityOptions = computed(() => {
    const set = new Set(
      this.queueItems()
        .map((item) => item.priority)
        .filter((priority): priority is string => !!priority),
    );
    return Array.from(set).sort();
  });
  readonly queueTruncated = computed(() => this.queueItems().length === this.reviewService.queueLimit);

  constructor() {
    this.selectionRequest$
      .pipe(
        switchMap((id) => {
          this.detailState.set('loading');
          return this.reviewService.getDetail(id).pipe(
            tap((detail) => {
              this.detail.set(detail);
              this.detailState.set('loaded');
            }),
            catchError(() => {
              this.detail.set(null);
              this.detailState.set('error');
              return of(null);
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();

    this.loadQueue();
  }

  loadQueue(onLoaded?: () => void): void {
    this.queueState.set('loading');
    this.reviewService
      .listPending()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items) => {
          this.queueItems.set(items);
          this.afterQueueLoaded();
          onLoaded?.();
        },
        error: () => {
          this.queueState.set('error');
        },
      });
  }

  onSearchTermChange(term: string): void {
    this.searchTerm.set(term);
    this.page.set(1);
    this.updateQueueState();
  }

  onPriorityFilterChange(priority: string | null): void {
    this.priorityFilter.set(priority);
    this.page.set(1);
    this.updateQueueState();
  }

  onPageChange(page: number): void {
    this.page.set(page);
  }

  selectItem(id: string | null): void {
    // Mientras se esta aprobando, las tarjetas ignoran la seleccion.
    if (this.submittingApprove()) return;

    this.selectedId.set(id);
    if (id === null) {
      this.detail.set(null);
      this.detailState.set('empty');
      return;
    }
    this.selectionRequest$.next(id);
  }

  retryDetail(): void {
    const id = this.selectedId();
    if (id) this.selectionRequest$.next(id);
  }

  approve(): void {
    if (this.submittingApprove()) return;
    // Se captura el id al hacer clic, no se relee selectedId() al terminar.
    const approvedId = this.selectedId();
    if (!approvedId) return;

    this.submittingApprove.set(true);
    const reviewedBy = resolveReviewedBy(this.authService.profile()?.id);

    this.reviewService
      .approve(approvedId, reviewedBy)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.submittingApprove.set(false);
          this.snackBar.open('Respuesta aprobada y enviada', 'Cerrar', { duration: 4000 });
          this.removeFromQueue(approvedId);
        },
        error: (error: unknown) => {
          this.submittingApprove.set(false);
          this.handleApproveError(error);
        },
      });
  }

  openRejectDialog(): void {
    const id = this.selectedId();
    if (!id) return;
    const reviewedBy = resolveReviewedBy(this.authService.profile()?.id);

    const dialogRef = this.dialog.open<RejectDialogComponent, RejectDialogData, RejectDialogResult>(
      RejectDialogComponent,
      { data: { interactionId: id, reviewedBy }, disableClose: true, width: '480px' },
    );

    dialogRef.afterClosed().subscribe((result) => {
      if (result === 'success') {
        this.snackBar.open('Respuesta rechazada. El sistema generará una nueva.', 'Cerrar', { duration: 4000 });
        // Si el id rechazado sigue pendiente despues de recargar la cola, el
        // detalle en pantalla quedo viejo (la respuesta pudo cambiar), asi
        // que se fuerza un refetch. Si ya no esta, no hace falta.
        this.loadQueue(() => {
          if (this.queueItems().some((item) => item.interaction_id === id)) {
            this.selectionRequest$.next(id);
          }
        });
      } else if (result === 'not-found') {
        this.snackBar.open('Esta solicitud ya no existe', 'Cerrar', { duration: 4000 });
        this.loadQueue();
      } else if (result === 'timeout-refresh') {
        this.loadQueue();
      }
    });
  }

  // Ante un error de red o del servidor al aprobar, no reintentamos solos:
  // el backend no detecta duplicados (confirmado: get_interaction_context en
  // backend/app/modules/internal_api/repositories/interaction_repository.py
  // busca solo por id, sin mirar el estado actual de decision), asi que un
  // reintento ciego podria publicar la respuesta dos veces. El boton Aprobar
  // queda habilitado, pero avisamos que conviene revisar el estado real en
  // la cola antes de volver a intentar.
  private handleApproveError(error: unknown): void {
    const category = classifyReviewError(error);
    switch (category) {
      case 'network':
      case 'server': {
        const ref = this.snackBar.open(
          'No pudimos confirmar si la respuesta se aprobó. Antes de reintentar, actualizá la cola y verificá.',
          'Actualizar cola',
        );
        ref.onAction().subscribe(() => this.loadQueue());
        return;
      }
      case 'not-found':
        this.snackBar.open('Esta solicitud ya no existe', 'Cerrar', { duration: 4000 });
        this.loadQueue();
        return;
      case 'forbidden':
        this.snackBar.open('No tenés permisos para aprobar esta respuesta', 'Cerrar', { duration: 4000 });
        return;
      case 'validation':
        this.snackBar.open('Revisá los datos ingresados', 'Cerrar', { duration: 4000 });
        return;
      default:
        this.snackBar.open('Ocurrió un error inesperado. Intentá de nuevo.', 'Cerrar', { duration: 4000 });
    }
  }

  private removeFromQueue(id: string): void {
    this.queueItems.update((items) => items.filter((item) => item.interaction_id !== id));
    this.afterQueueLoaded();
  }

  private afterQueueLoaded(): void {
    // Si la seleccion sigue en la lista se mantiene; si no, se selecciona
    // la primera visible (segun el filtro actual) o queda vacio.
    const current = this.selectedId();
    const stillThere = current !== null && this.queueItems().some((item) => item.interaction_id === current);
    if (!stillThere) {
      const first = this.filteredItems()[0] ?? null;
      this.selectItemIgnoringLock(first ? first.interaction_id : null);
    }
    this.updateQueueState();
    this.clampPage();
  }

  // Igual que selectItem pero sin el bloqueo de submittingApprove: se usa
  // despues de que una operacion ya termino, nunca mientras esta en curso.
  private selectItemIgnoringLock(id: string | null): void {
    this.selectedId.set(id);
    if (id === null) {
      this.detail.set(null);
      this.detailState.set('empty');
      return;
    }
    this.selectionRequest$.next(id);
  }

  private updateQueueState(): void {
    if (this.queueItems().length === 0) {
      this.queueState.set('empty');
    } else if (this.filteredItems().length === 0) {
      this.queueState.set('no-results');
    } else {
      this.queueState.set('loaded');
    }
  }

  private clampPage(): void {
    this.page.update((current) => Math.min(current, this.totalPages()));
  }
}
