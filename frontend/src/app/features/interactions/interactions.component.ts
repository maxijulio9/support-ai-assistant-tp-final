import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { InteractionsService } from './interactions.service';
import { DecisionStatus, STATUS_FILTER_OPTIONS, decisionStatus } from './interaction-status';
import { safeTicketUrl } from '../../shared/safe-ticket-url';
import { formatShortDate } from '../../shared/format-short-date';
import { InteractionListItem } from '../../api/models/interaction-list-item';

export type RowsState = 'loading' | 'empty' | 'no-results' | 'error' | 'loaded';

const PAGE_SIZE = 10;

@Component({
  selector: 'app-interactions',
  standalone: true,
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatTooltipModule,
    RouterLink,
  ],
  templateUrl: './interactions.component.html',
  styleUrl: './interactions.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InteractionsComponent {
  private readonly interactionsService = inject(InteractionsService);
  private readonly destroyRef = inject(DestroyRef);

  readonly items = signal<InteractionListItem[]>([]);
  readonly loadState = signal<'loading' | 'loaded' | 'error'>('loading');
  readonly searchTerm = signal('');
  readonly statusFilter = signal<string | null>(null);
  readonly categoryFilter = signal<string | null>(null);
  readonly page = signal(1);

  readonly pageSize = PAGE_SIZE;
  readonly historyLimit = this.interactionsService.historyLimit;
  readonly statusOptions = STATUS_FILTER_OPTIONS;
  readonly skeletonRows = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

  readonly filteredItems = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const status = this.statusFilter();
    const category = this.categoryFilter();
    return this.items().filter((item) => {
      const matchesTerm =
        !term || item.issue_key.toLowerCase().includes(term) || (item.summary ?? '').toLowerCase().includes(term);
      const matchesStatus = !status || item.decision === status;
      const matchesCategory = !category || item.category === category;
      return matchesTerm && matchesStatus && matchesCategory;
    });
  });

  readonly categoryOptions = computed(() => {
    const set = new Set(
      this.items()
        .map((item) => item.category)
        .filter((category): category is string => !!category),
    );
    return Array.from(set).sort();
  });

  readonly hasActiveFilters = computed(
    () => this.searchTerm().trim() !== '' || this.statusFilter() !== null || this.categoryFilter() !== null,
  );

  readonly totalFiltered = computed(() => this.filteredItems().length);
  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.totalFiltered() / PAGE_SIZE)));
  // Se deriva de page() en vez de recortarla con un effect: si un filtro
  // reduce el total y la pagina elegida queda fuera de rango, esta es la
  // unica fuente que se usa para mostrar filas y el texto de paginacion.
  readonly effectivePage = computed(() => Math.min(this.page(), this.totalPages()));
  readonly pageItems = computed(() => {
    const start = (this.effectivePage() - 1) * PAGE_SIZE;
    return this.filteredItems().slice(start, start + PAGE_SIZE);
  });

  readonly truncated = computed(() => this.items().length === this.interactionsService.historyLimit);

  readonly rowsState = computed<RowsState>(() => {
    if (this.loadState() === 'loading') return 'loading';
    if (this.loadState() === 'error') return 'error';
    if (this.items().length === 0) return 'empty';
    if (this.filteredItems().length === 0) return 'no-results';
    return 'loaded';
  });

  constructor() {
    this.loadHistory();
  }

  loadHistory(): void {
    this.loadState.set('loading');
    this.interactionsService
      .listRecent()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items) => {
          this.items.set(items);
          this.loadState.set('loaded');
        },
        error: () => {
          this.loadState.set('error');
        },
      });
  }

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchTerm.set(value);
    this.page.set(1);
  }

  onStatusFilterChange(value: string | null): void {
    this.statusFilter.set(value);
    this.page.set(1);
  }

  onCategoryFilterChange(value: string | null): void {
    this.categoryFilter.set(value);
    this.page.set(1);
  }

  clearFilters(): void {
    this.searchTerm.set('');
    this.statusFilter.set(null);
    this.categoryFilter.set(null);
    this.page.set(1);
  }

  onPrevPage(): void {
    if (this.effectivePage() > 1) this.page.set(this.effectivePage() - 1);
  }

  onNextPage(): void {
    if (this.effectivePage() < this.totalPages()) this.page.set(this.effectivePage() + 1);
  }

  statusFor(decision: string | null): DecisionStatus {
    return decisionStatus(decision);
  }

  readonly safeTicketUrl = safeTicketUrl;
  readonly formatDate = formatShortDate;
}
