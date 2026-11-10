import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable, Subscription, from, map, of, switchMap } from 'rxjs';
import { InteractionFilters } from '../case-grouping';
import { HistoryRange } from '../history-range';
import { InteractionsService } from '../interactions.service';
import {
  buildExportRows,
  exportDoneMessage,
  exportFileName,
  exportScopeNotice,
} from './history-export';
import { ExportCollection, collectExportItems } from './history-export-collect';
import { buildPdf, csvBlob, downloadBlob } from './history-export-files';

export type ExportFormat = 'csv' | 'pdf';

const ERROR_MESSAGE = 'No se pudo preparar el archivo. Intentá de nuevo.';
const EMPTY_MESSAGE = 'No hay interacciones para exportar con estos filtros.';
const SNACKBAR_MS = 5000;
const ERROR_SNACKBAR_MS = 15000;

// Boton "Exportar" del Historial, con menu para CSV y PDF. Exporta lo que la
// persona esta viendo: pide al servidor por paginas, hasta el tope, el periodo
// (o todo el historial sin rango) y aplica los mismos filtros.
@Component({
  selector: 'app-history-export',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatMenuModule, MatProgressSpinnerModule],
  templateUrl: './history-export.component.html',
  styleUrl: './history-export.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistoryExportComponent {
  private readonly interactionsService = inject(InteractionsService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly range = input<HistoryRange | null>(null);
  readonly filters = input.required<InteractionFilters>();
  readonly statusLabel = input<string | null>(null);
  // Total que dio la lista (del periodo, o de todo el historial sin rango), para avisar del tope antes de exportar
  readonly periodTotal = input(0);
  readonly disabled = input(false);

  readonly preparing = signal(false);
  readonly notice = computed(() => exportScopeNotice(this.range(), this.periodTotal()));

  private subscription: Subscription | null = null;

  constructor() {
    // Al irse de la pantalla se cancelan los pedidos en curso
    this.destroyRef.onDestroy(() => this.subscription?.unsubscribe());
  }

  export(format: ExportFormat): void {
    if (this.preparing()) return;
    this.preparing.set(true);

    const range = this.range();
    const filters = this.filters();
    // Con o sin rango se piden todas las paginas hasta el tope, no solo lo cargado
    const collection$: Observable<ExportCollection> = collectExportItems(
      (offset, limit) =>
        this.interactionsService.listPage({ range, status: filters.status, category: filters.category, limit, offset }),
      filters,
    );

    this.subscription = collection$
      .pipe(
        switchMap((collection) => {
          const rows = buildExportRows(collection.items);
          if (rows.length === 0) return of({ collection, blob: null });
          const blob$ =
            format === 'csv'
              ? of(csvBlob(rows))
              : from(buildPdf({ rows, filters: { range, statusLabel: this.statusLabel(), category: filters.category, term: filters.term }, generatedAt: new Date(), capped: collection.capped }));
          return blob$.pipe(map((blob) => ({ collection, blob })));
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ collection, blob }) => {
          this.preparing.set(false);
          if (!blob) {
            this.snackBar.open(EMPTY_MESSAGE, 'Cerrar', { duration: SNACKBAR_MS });
            return;
          }
          downloadBlob(blob, exportFileName(format));
          this.snackBar.open(exportDoneMessage(collection.items.length, collection.total, collection.capped), 'Cerrar', {
            duration: SNACKBAR_MS,
          });
        },
        error: () => {
          this.preparing.set(false);
          this.snackBar
            .open(ERROR_MESSAGE, 'Reintentar', { duration: ERROR_SNACKBAR_MS })
            .onAction()
            .subscribe(() => this.export(format));
        },
      });
  }
}
