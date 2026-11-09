import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { InteractionsService } from './interactions.service';
import { STATUS_FILTER_OPTIONS } from './interaction-status';
import { buildCases, filterInteractions } from './case-grouping';
import { CaseTableComponent } from './case-table/case-table.component';
import { PAGE_SIZE_OPTIONS, paginateCases } from './history-pagination';
import { parseHistoryParams, sanitizeCategory, serializeHistoryParams, toggleExpanded } from './history-url-state';
import { InteractionListItem } from '../../api/models/interaction-list-item';

export type RowsState = 'loading' | 'empty' | 'no-results' | 'error' | 'loaded';

@Component({
  selector: 'app-interactions',
  standalone: true,
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    CaseTableComponent,
  ],
  templateUrl: './interactions.component.html',
  styleUrl: './interactions.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InteractionsComponent {
  private readonly interactionsService = inject(InteractionsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  // Lo que viene en la URL se restaura al abrir la pantalla; lo invalido se ignora
  private readonly initial = parseHistoryParams(
    this.route.snapshot.queryParamMap,
    STATUS_FILTER_OPTIONS.map((option) => option.value),
  );

  readonly items = signal<InteractionListItem[]>([]);
  readonly loadState = signal<'loading' | 'loaded' | 'error'>('loading');
  readonly searchTerm = signal(this.initial.term);
  readonly statusFilter = signal<string | null>(this.initial.status);
  private readonly requestedCategory = signal<string | null>(this.initial.category);
  readonly page = signal(this.initial.page);
  readonly pageSize = signal(this.initial.pageSize);
  readonly expandedCases = signal<string[]>(this.initial.expanded);

  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  readonly historyLimit = this.interactionsService.historyLimit;
  readonly statusOptions = STATUS_FILTER_OPTIONS;
  readonly skeletonRows = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

  // Los filtros se aplican a las interacciones y despues se agrupa: un caso
  // aparece si alguna de sus interacciones cumple
  readonly filteredItems = computed(() =>
    filterInteractions(this.items(), {
      term: this.searchTerm(),
      status: this.statusFilter(),
      category: this.categoryFilter(),
    }),
  );

  readonly cases = computed(() => buildCases(this.items(), this.filteredItems(), this.historyLimit));

  readonly categoryOptions = computed(() => {
    const set = new Set(
      this.items()
        .map((item) => item.category)
        .filter((category): category is string => !!category),
    );
    return Array.from(set).sort();
  });

  // Los casos abiertos que no estan entre los cargados se ignoran
  readonly knownExpandedCases = computed(() => {
    if (this.loadState() !== 'loaded') return this.expandedCases();
    const known = new Set(this.items().map((item) => item.issue_key));
    return this.expandedCases().filter((key) => known.has(key));
  });

  // Una categoria de la URL que no esta entre las cargadas se ignora
  readonly categoryFilter = computed(() =>
    this.loadState() === 'loaded'
      ? sanitizeCategory(this.requestedCategory(), this.categoryOptions())
      : this.requestedCategory(),
  );

  readonly hasActiveFilters = computed(
    () => this.searchTerm().trim() !== '' || this.statusFilter() !== null || this.categoryFilter() !== null,
  );

  readonly totalFiltered = computed(() => this.cases().length);
  // Se deriva de page() en vez de corregirla con un effect: una pagina fuera
  // de rango (por ejemplo la de un enlace viejo) se ignora y vuelve a la
  // primera. Esta es la unica fuente que se usa para mostrar filas y el texto
  // de paginacion.
  readonly pagination = computed(() => paginateCases(this.cases(), this.page(), this.pageSize()));
  readonly pageItems = computed(() => this.pagination().items);
  readonly effectivePage = computed(() => this.pagination().page);
  readonly totalPages = computed(() => this.pagination().totalPages);

  readonly truncated = computed(() => this.items().length === this.interactionsService.historyLimit);

  readonly rowsState = computed<RowsState>(() => {
    if (this.loadState() === 'loading') return 'loading';
    if (this.loadState() === 'error') return 'error';
    if (this.items().length === 0) return 'empty';
    if (this.cases().length === 0) return 'no-results';
    return 'loaded';
  });

  constructor() {
    this.loadHistory();

    // Cada cambio se escribe en la URL sin sumar entradas al historial del
    // navegador: Atras vuelve a la pantalla anterior, no al estado anterior
    effect(() => {
      const queryParams = serializeHistoryParams({
        term: this.searchTerm(),
        status: this.statusFilter(),
        category: this.categoryFilter(),
        // Hasta que cargan los datos no se sabe cuantas paginas hay: se conserva la pedida
        page: this.loadState() === 'loaded' ? this.effectivePage() : this.page(),
        pageSize: this.pageSize(),
        expanded: this.knownExpandedCases(),
      });
      void this.router.navigate([], { relativeTo: this.route, queryParams, replaceUrl: true });
    });
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
    this.requestedCategory.set(value);
    this.page.set(1);
  }

  clearFilters(): void {
    this.searchTerm.set('');
    this.statusFilter.set(null);
    this.requestedCategory.set(null);
    this.page.set(1);
  }

  onCaseToggled(issueKey: string): void {
    this.expandedCases.update((expanded) => toggleExpanded(expanded, issueKey));
  }

  onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.page.set(1);
  }

  onPrevPage(): void {
    if (this.effectivePage() > 1) this.page.set(this.effectivePage() - 1);
  }

  onNextPage(): void {
    if (this.effectivePage() < this.totalPages()) this.page.set(this.effectivePage() + 1);
  }
}
