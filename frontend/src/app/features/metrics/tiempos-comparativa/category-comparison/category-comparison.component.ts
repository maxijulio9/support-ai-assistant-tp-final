import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { CategoryComparisonRow } from '../category-comparison';
import { cohortLabel } from '../response-times-format';
import { closurePlaceholder } from '../closure';
import { StatsView, statsPlaceholder } from '../stats-view';

@Component({
  selector: 'app-category-comparison',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './category-comparison.component.html',
  styleUrl: './category-comparison.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryComparisonComponent {
  readonly rows = input.required<CategoryComparisonRow[]>();
  readonly baselineHasData = input.required<boolean>();
  readonly showClosure = input(false);
  // Como se mide el cierre en cada lado, para mostrarlo pegado a las cifras
  readonly closureNote = input('');

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
