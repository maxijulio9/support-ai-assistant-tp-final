import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { CategoryComparisonRow } from '../category-comparison';
import { cohortLabel } from '../response-times-format';
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

  readonly automaticLabel = cohortLabel('automatic');
  readonly baselineLabel = cohortLabel('baseline');
  // En pantallas angostas el encabezado del baseline se acorta
  readonly baselineNarrowLabel = cohortLabel('baseline', true);

  placeholder(view: StatsView): string | null {
    return statsPlaceholder(view);
  }
}
