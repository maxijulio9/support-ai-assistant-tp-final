import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { CategoryComparisonRow } from '../category-comparison';
import { cohortLabel } from '../response-times-format';
import { closurePlaceholder } from '../closure';
import { NO_DATA_TEXT, StatsView, statsPlaceholder } from '../stats-view';
import { NoDataComponent } from '../no-data/no-data.component';

@Component({
  selector: 'app-category-comparison',
  standalone: true,
  imports: [MatIconModule, NoDataComponent],
  templateUrl: './category-comparison.component.html',
  styleUrl: './category-comparison.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryComparisonComponent {
  readonly rows = input.required<CategoryComparisonRow[]>();
  readonly baselineHasData = input.required<boolean>();
  // Minimo de tickets del contrato, para explicar las celdas sin datos
  readonly minSample = input.required<number>();
  readonly showClosure = input(false);
  // Como se mide el cierre en cada lado, para mostrarlo pegado a las cifras
  readonly closureNote = input('');

  readonly noData = NO_DATA_TEXT;
  readonly automaticLabel = cohortLabel('automatic');
  readonly baselineLabel = cohortLabel('baseline');
  // En pantallas angostas el encabezado del baseline se acorta
  readonly baselineNarrowLabel = cohortLabel('baseline', true);

  placeholder(view: StatsView): string | null {
    return statsPlaceholder(view);
  }

  closureCell(view: StatsView, tickets: number): string | null {
    return closurePlaceholder(view, tickets);
  }
}
