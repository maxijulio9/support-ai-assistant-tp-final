import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-metrics-tiempos-comparativa',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './tiempos-comparativa.component.html',
  styleUrl: './tiempos-comparativa.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TiemposComparativaComponent {}
