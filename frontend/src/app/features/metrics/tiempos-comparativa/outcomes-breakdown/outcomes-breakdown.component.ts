import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { cohortAccentVar } from '../cohort-card';
import { OutcomeRow } from '../outcomes-breakdown';

@Component({
  selector: 'app-outcomes-breakdown',
  standalone: true,
  templateUrl: './outcomes-breakdown.component.html',
  styleUrl: './outcomes-breakdown.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OutcomesBreakdownComponent {
  readonly rows = input.required<OutcomeRow[]>();

  // Las barras son de la cohorte con revision, mismo color que su tarjeta
  readonly accent = `var(${cohortAccentVar('reviewed')})`;
}
