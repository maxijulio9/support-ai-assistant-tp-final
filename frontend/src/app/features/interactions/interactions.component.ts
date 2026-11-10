import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { InteractionsService } from './interactions.service';
import { STATUS_FILTER_OPTIONS } from './interaction-status';
import { buildCases, filterInteractions, limitNoticeText, mergeInteractions, unresolvedIncompleteKeys } from './case-grouping';
import { HistoryExportComponent } from './history-export/history-export.component';
import { CaseTableComponent } from './case-table/case-table.component';
import { PAGE_SIZE_OPTIONS, paginateCases } from './history-pagination';
import { parseHistoryParams, sanitizeCategory, serializeHistoryParams, toggleExpanded } from './history-url-state';
import { HistoryRange, resolveHistoryRange } from './history-range';
import { parseIsoDateLocal, toIsoDate } from '../dashboard/period';
import { InteractionListItem } from '../../api/models/interaction-list-item';

export type CompletionState = 'loading' | 'error';
export type RowsState = 'loading' | 'empty' | 'no-results' | 'error' | 'loaded';

@Component({
  selector: 'app-interactions',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDatepickerModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    CaseTableComponent,
    HistoryExportComponent,
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

  // Lo que devolvio la lista, y por separado lo que se pidio despues para
  // completar casos cortados por el limite
  readonly items = signal<InteractionListItem[]>([]);
  private readonly total = signal(0);
  private readonly extraItems = signal<InteractionListItem[]>([]);
  private readonly completedKeys = signal<ReadonlySet<string>>(new Set());
  readonly completion = signal<Record<string, CompletionState>>({});
  readonly allItems = computed(() => mergeInteractions(this.items(), this.extraItems()));
  readonly loadState = signal<'loading' | 'loaded' | 'error'>('loading');
  readonly searchTerm = signal(this.initial.term);
  readonly statusFilter = signal<string | null>(this.initial.status);
  private readonly requestedCategory = signal<string | null>(this.initial.category);
  // Rango que se pide al servidor; el resto de los filtros se aplica sobre lo cargado
  readonly range = signal<HistoryRange | null>(this.initial.range);
  readonly page = signal(this.initial.page);
  readonly pageSize = signal(this.initial.pageSize);
  readonly expandedCases = signal<string[]>(this.initial.expanded);

  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  // No se pueden elegir dias futuros
  readonly today = new Date();
  readonly rangeStart = new FormControl<Date | null>(null);
  readonly rangeEnd = new FormControl<Date | null>(null);
  private loadSubscription: Subscription | null = null;
  readonly historyLimit = this.interactionsService.historyLimit;
  readonly statusOptions = STATUS_FILTER_OPTIONS;
  readonly skeletonRows = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

  // Los filtros se aplican a las interacciones y despues se agrupa: un caso
  // aparece si alguna de sus interacciones cumple
  readonly filteredItems = computed(() =>
    filterInteractions(this.allItems(), {
      term: this.searchTerm(),
      status: this.statusFilter(),
      category: this.categoryFilter(),
    }),
  );

  // Tickets que el limite pudo cortar y todavia no se completaron
  private readonly incompleteKeys = computed(() =>
    unresolvedIncompleteKeys(this.items(), this.historyLimit, this.completedKeys()),
  );

  readonly cases = computed(() => buildCases(this.allItems(), this.filteredItems(), this.incompleteKeys()));

  readonly categoryOptions = computed(() => {
    const set = new Set(
      this.allItems()
        .map((item) => item.category)
        .filter((category): category is string => !!category),
    );
    return Array.from(set).sort();
  });

  // Los casos abiertos que no estan entre los cargados se ignoran
  readonly knownExpandedCases = computed(() => {
    if (this.loadState() !== 'loaded') return this.expandedCases();
    const known = new Set(this.allItems().map((item) => item.issue_key));
    return this.expandedCases().filter((key) => known.has(key));
  });

  // Una categoria de la URL que no esta entre las cargadas se ignora
  readonly categoryFilter = computed(() =>
    this.loadState() === 'loaded'
      ? sanitizeCategory(this.requestedCategory(), this.categoryOptions())
      : this.requestedCategory(),
  );

  // Lo que se exporta es lo que se esta viendo: mismos filtros que la lista
  readonly exportFilters = computed(() => ({
    term: this.searchTerm(),
    status: this.statusFilter(),
    category: this.categoryFilter(),
  }));
  readonly statusLabel = computed(
    () => this.statusOptions.find((option) => option.value === this.statusFilter())?.label ?? null,
  );
  readonly periodTotal = computed(() => this.total());

  readonly hasActiveFilters = computed(
    () =>
      this.searchTerm().trim() !== '' ||
      this.statusFilter() !== null ||
      this.categoryFilter() !== null ||
      this.range() !== null,
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

  readonly limitNotice = computed(() => limitNoticeText(this.items().length, this.total(), this.range() !== null));

  readonly rowsState = computed<RowsState>(() => {
    if (this.loadState() === 'loading') return 'loading';
    if (this.loadState() === 'error') return 'error';
    if (this.items().length === 0) return 'empty';
    if (this.cases().length === 0) return 'no-results';
    return 'loaded';
  });

  constructor() {
    this.syncRangeControls();
    this.loadHistory();

    // Cada cambio se escribe en la URL sin sumar entradas al historial del
    // navegador: Atras vuelve a la pantalla anterior, no al estado anterior
    effect(() => {
      const queryParams = serializeHistoryParams({
        term: this.searchTerm(),
        status: this.statusFilter(),
        category: this.categoryFilter(),
        range: this.range(),
        // Hasta que cargan los datos no se sabe cuantas paginas hay: se conserva la pedida
        page: this.loadState() === 'loaded' ? this.effectivePage() : this.page(),
        pageSize: this.pageSize(),
        expanded: this.knownExpandedCases(),
      });
      void this.router.navigate([], { relativeTo: this.route, queryParams, replaceUrl: true });
    });

    // Al abrir un caso marcado como posiblemente incompleto (tambien al
    // restaurarlo desde la URL) se piden sus interacciones. Un caso con error
    // no se vuelve a pedir solo: lo reintenta la persona.
    effect(() => {
      if (this.loadState() !== 'loaded') return;
      const incomplete = this.incompleteKeys();
      for (const key of this.knownExpandedCases()) {
        if (incomplete.has(key) && !(key in untracked(this.completion))) this.completeCase(key);
      }
    });
  }

  completeCase(issueKey: string): void {
    this.completion.update((state) => ({ ...state, [issueKey]: 'loading' }));
    this.interactionsService
      .listByIssue(issueKey)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => {
          this.extraItems.update((extra) => mergeInteractions(extra, rows));
          this.completedKeys.update((keys) => new Set(keys).add(issueKey));
          this.completion.update(({ [issueKey]: _done, ...rest }) => rest);
        },
        error: () => {
          this.completion.update((state) => ({ ...state, [issueKey]: 'error' }));
        },
      });
  }

  loadHistory(): void {
    this.loadState.set('loading');
    // Un pedido nuevo descarta el anterior: una respuesta lenta de otro rango no pisa a la actual
    this.loadSubscription?.unsubscribe();
    this.loadSubscription = this.interactionsService
      .listRecent(this.range())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ items, total }) => {
          this.items.set(items);
          this.total.set(total);
          this.extraItems.set([]);
          this.completedKeys.set(new Set());
          this.completion.set({});
          this.loadState.set('loaded');
        },
        error: () => {
          this.loadState.set('error');
        },
      });
  }

  private syncRangeControls(): void {
    const range = this.range();
    this.rangeStart.setValue(range ? parseIsoDateLocal(range.from) : null, { emitEvent: false });
    this.rangeEnd.setValue(range ? parseIsoDateLocal(range.to) : null, { emitEvent: false });
  }

  // Se dispara al elegir o escribir el ultimo dia, o al vaciar el campo. Con
  // un solo extremo no se hace nada hasta que esten los dos; un rango
  // invalido (por ejemplo desde mayor que hasta) vuelve al anterior.
  onRangeChanged(): void {
    const start = this.rangeStart.value;
    const end = this.rangeEnd.value;
    if (start && !end) return;

    const next = start && end ? resolveHistoryRange(toIsoDate(start), toIsoDate(end), this.today) : null;
    if (start && end && next === null) {
      this.syncRangeControls();
      return;
    }
    this.applyRange(next);
  }

  // Cambiar el rango pide la lista de nuevo, vuelve a la pagina 1 y cierra los casos abiertos
  private applyRange(next: HistoryRange | null): void {
    const current = this.range();
    if (current?.from === next?.from && current?.to === next?.to) return;
    this.range.set(next);
    this.page.set(1);
    this.expandedCases.set([]);
    this.loadHistory();
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
    this.rangeStart.setValue(null, { emitEvent: false });
    this.rangeEnd.setValue(null, { emitEvent: false });
    this.applyRange(null);
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
