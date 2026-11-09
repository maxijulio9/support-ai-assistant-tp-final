import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { InfoHintComponent } from '../../../../shared/info-hint/info-hint.component';
import { pageRangeText, paginate } from '../category-pagination';

export interface CategoryRow {
  category: string;
  total: number;
  percent: number;
}

// Cuantas categorias entran por pagina: se eligio para que la tarjeta tenga
// la altura de la del mapa de calor que tiene al lado
export const CATEGORIES_PAGE_SIZE = 5;

@Component({
  selector: 'app-categories-card',
  standalone: true,
  imports: [DecimalPipe, MatButtonModule, MatIconModule, MatSlideToggleModule, InfoHintComponent],
  templateUrl: './categories-card.component.html',
  styleUrl: './categories-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoriesCardComponent {
  // Ya ordenadas de mayor a menor
  readonly rows = input.required<CategoryRow[]>();
  readonly helpTitle = input.required<string>();
  readonly helpText = input.required<string>();

  readonly asTable = signal(false);
  private readonly requestedPage = signal(1);

  readonly page = computed(() => paginate(this.rows(), this.requestedPage(), CATEGORIES_PAGE_SIZE));
  readonly rangeText = computed(() => pageRangeText(this.page()));
  // La lider es la de mayor volumen de todo el periodo, no la de la pagina que se ve
  readonly leader = computed(() => this.rows()[0] ?? null);

  toggleTable(): void {
    this.asTable.update((value) => !value);
  }

  previous(): void {
    if (this.page().hasPrevious) this.requestedPage.set(this.page().page - 1);
  }

  next(): void {
    if (this.page().hasNext) this.requestedPage.set(this.page().page + 1);
  }
}
