import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CohortCard } from '../cohort-card';

@Component({
  selector: 'app-cohort-card',
  standalone: true,
  templateUrl: './cohort-card.component.html',
  styleUrl: './cohort-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CohortCardComponent {
  readonly card = input.required<CohortCard>();
  readonly showClosure = input(false);
}
