import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { InteractionListItem } from '../../api/models/interaction-list-item';
import { formatRelativeTime } from '../../shared/format-relative-time';

export type QueueState = 'loading' | 'empty' | 'no-results' | 'error' | 'loaded';

const PAGE_SIZE = 6;

// Heuristica de presentacion: "priority" es texto libre que viene de la
// instancia JSM de cada organizacion (ver
// backend/app/modules/internal_api/clients/jsm_project_client.py:116,
// GET /rest/api/3/priority). No hay garantia de que toda organizacion use
// "alta"/"high": un valor que no matchea se muestra con un punto neutro.
const HIGH_PRIORITY_PATTERN = /alta|high/i;

@Component({
  selector: 'app-review-queue',
  standalone: true,
  imports: [MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule],
  templateUrl: './review-queue.component.html',
  styleUrl: './review-queue.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReviewQueueComponent {
  readonly items = input<InteractionListItem[]>([]);
  readonly selectedId = input<string | null>(null);
  readonly state = input<QueueState>('loading');
  readonly totalPending = input(0);
  readonly totalFiltered = input(0);
  readonly page = input(1);
  readonly totalPages = input(1);
  readonly searchTerm = input('');
  readonly priorityFilter = input<string | null>(null);
  readonly priorityOptions = input<string[]>([]);
  readonly truncated = input(false);

  readonly searchTermChange = output<string>();
  readonly priorityFilterChange = output<string | null>();
  readonly selectItem = output<string>();
  readonly pageChange = output<number>();
  readonly retry = output<void>();

  readonly pageSize = PAGE_SIZE;
  readonly skeletonRows = [0, 1, 2, 3, 4, 5];

  isHighPriority(priority: string | null | undefined): boolean {
    return !!priority && HIGH_PRIORITY_PATTERN.test(priority);
  }

  readonly relativeTime = formatRelativeTime;

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchTermChange.emit(value);
  }

  onPriorityChange(value: string | null): void {
    this.priorityFilterChange.emit(value);
  }

  onPrevPage(): void {
    if (this.page() > 1) this.pageChange.emit(this.page() - 1);
  }

  onNextPage(): void {
    if (this.page() < this.totalPages()) this.pageChange.emit(this.page() + 1);
  }
}
