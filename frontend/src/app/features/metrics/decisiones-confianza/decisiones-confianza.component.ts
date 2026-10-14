import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-metrics-decisiones-confianza',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './decisiones-confianza.component.html',
  styleUrl: './decisiones-confianza.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DecisionesConfianzaComponent {}
