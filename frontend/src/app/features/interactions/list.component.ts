import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-interactions-list',
  standalone: true,
  template: `<p>Interacciones</p>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InteractionsListComponent {}
