import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { decisionStatus } from './interaction-status';

// Punto de color y texto de una decision, el mismo en la fila del caso y en
// cada interaccion de su detalle
@Component({
  selector: 'app-decision-chip',
  standalone: true,
  imports: [MatIconModule],
  template: `<span class="chip" [class]="'chip chip--' + status().tone">
    @if (status().icon; as icon) {
      <mat-icon class="chip-icon" aria-hidden="true">{{ icon }}</mat-icon>
    } @else {
      <span class="dot"></span>
    }
    {{ status().label }}
  </span>`,
  styles: `
    :host {
      display: inline-flex;
    }

    .chip {
      display: inline-flex;
      align-items: center;
      gap: var(--app-space-xs);
      font: var(--app-text-subtitle);
    }

    .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background-color: currentColor;
    }

    .chip--success {
      color: var(--app-color-success);
    }

    .chip--warning {
      color: var(--app-color-warning);
    }

    .chip--error {
      color: var(--mat-sys-error);
    }

    .chip-icon {
      width: 16px;
      height: 16px;
      font-size: 16px;
    }

    .chip--failed {
      color: var(--app-color-decision-publish-failed);
    }

    .chip--resolved {
      color: var(--mat-sys-tertiary);
    }

    .chip--neutral {
      color: var(--app-color-text-secondary);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DecisionChipComponent {
  readonly decision = input.required<string | null>();
  readonly status = computed(() => decisionStatus(this.decision()));
}
