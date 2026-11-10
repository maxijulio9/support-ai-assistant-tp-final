import { ChangeDetectionStrategy, Component } from '@angular/core';
import { INACTIVE_PROJECT_NOTICE } from '../../shared/project-activity';

// Aviso que se muestra donde un proyecto inactivo no deja editar
@Component({
  selector: 'app-project-inactive-notice',
  standalone: true,
  template: `<p class="inactive-notice" role="status">{{ text }}</p>`,
  styles: `
    :host {
      display: block;
    }

    .inactive-notice {
      margin: 0 0 var(--app-space-sm);
      padding: var(--app-space-xs) var(--app-space-sm);
      border-radius: var(--app-radius-sm);
      background-color: color-mix(in srgb, var(--app-color-warning) 10%, var(--mat-sys-surface));
      color: var(--app-color-warning);
      font: var(--app-text-subtitle);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectInactiveNoticeComponent {
  readonly text = INACTIVE_PROJECT_NOTICE;
}
