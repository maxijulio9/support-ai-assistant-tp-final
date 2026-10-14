import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-metrics-resumen',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './resumen.component.html',
  styleUrl: './resumen.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResumenComponent {}
