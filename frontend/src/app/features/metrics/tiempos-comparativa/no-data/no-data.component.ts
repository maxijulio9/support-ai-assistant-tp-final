import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { InfoHintComponent } from '../../../../shared/info-hint/info-hint.component';
import { NO_DATA_TEXT, noDataExplanation, noDataLabel } from '../stats-view';

// Celda sin cifras por muestra chica: el texto apagado y un icono que explica
// el motivo. El lector de pantalla lee solo el nombre del icono, no repite el texto.
@Component({
  selector: 'app-no-data',
  standalone: true,
  imports: [InfoHintComponent],
  template: `
    <span class="no-data-text" aria-hidden="true">{{ text }}</span>
    <app-info-hint [title]="text" [text]="explanation()" [label]="label()" />
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: var(--app-space-xs);
    }

    .no-data-text {
      color: var(--app-color-text-secondary);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NoDataComponent {
  readonly minSample = input.required<number>();

  readonly text = NO_DATA_TEXT;
  readonly explanation = computed(() => noDataExplanation(this.minSample()));
  readonly label = computed(() => noDataLabel(this.minSample()));
}
