import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { ConfigService } from './config.service';
import { classifyFormError } from '../../shared/form-error';
import { JsmStatus } from '../../api/models/jsm-status';

export type ProjectStatusesState = 'loading' | 'error' | 'loaded';

const LOAD_ERROR_MESSAGE = 'Ocurrió un error inesperado. Intentá de nuevo.';

@Component({
  selector: 'app-project-statuses',
  standalone: true,
  imports: [MatButtonModule],
  templateUrl: './project-statuses.component.html',
  styleUrl: './project-statuses.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectStatusesComponent {
  private readonly configService = inject(ConfigService);
  private readonly destroyRef = inject(DestroyRef);

  readonly projectKey = input.required<string>();

  readonly state = signal<ProjectStatusesState>('loading');
  readonly loadErrorMessage = signal<string | null>(null);
  readonly statuses = signal<JsmStatus[]>([]);

  constructor() {
    // GET .../statuses escribe en ticket_status como efecto secundario: se
    // llama una sola vez por cada proyecto elegido, nunca en cada render.
    effect(() => {
      const projectKey = this.projectKey();
      this.fetchStatuses(projectKey);
    });
  }

  retryLoad(): void {
    this.fetchStatuses(this.projectKey());
  }

  private fetchStatuses(projectKey: string): void {
    this.state.set('loading');
    this.loadErrorMessage.set(null);

    this.configService
      .listProjectStatuses(projectKey)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (statuses) => {
          this.statuses.set(statuses);
          this.state.set('loaded');
        },
        error: (error: unknown) => {
          const result = classifyFormError(error);
          this.loadErrorMessage.set(result.message ?? LOAD_ERROR_MESSAGE);
          this.state.set('error');
        },
      });
  }
}
