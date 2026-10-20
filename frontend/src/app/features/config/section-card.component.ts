import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { SectionCardLoadState, SectionCardTone } from './config-readiness';

// Tarjeta reutilizable del centro de Configuracion: icono, titulo,
// descripcion, chip de estado y "Abrir" como link de ruta. Cada seccion le
// pasa su propio chipLabel/chipTone ya resueltos (ver config-readiness.ts e
// indexing-status-display.ts); esta tarjeta no decide esa logica, solo la
// muestra.
@Component({
  selector: 'app-section-card',
  standalone: true,
  imports: [NgTemplateOutlet, RouterLink, MatIconModule],
  templateUrl: './section-card.component.html',
  styleUrl: './section-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SectionCardComponent {
  readonly icon = input.required<string>();
  readonly title = input.required<string>();
  readonly description = input.required<string>();
  readonly loadState = input<SectionCardLoadState>('loaded');
  readonly chipLabel = input('');
  readonly chipTone = input<SectionCardTone>('neutral');
  readonly routerLink = input<string | null>(null);
  readonly disabled = input(false);

  readonly retry = output<void>();

  get isLink(): boolean {
    return this.routerLink() !== null && !this.disabled() && this.loadState() !== 'error';
  }
}
