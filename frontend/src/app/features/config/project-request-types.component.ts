import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ConfigService } from './config.service';
import { classifyFormError } from '../../shared/form-error';
import { ProjectRequestType } from '../../api/models/project-request-type';

export type ProjectRequestTypesState = 'loading' | 'error' | 'loaded';

const GENERIC_ERROR_MESSAGE = 'Ocurrió un error inesperado. Intentá de nuevo.';

@Component({
  selector: 'app-project-request-types',
  standalone: true,
  imports: [MatButtonModule],
  templateUrl: './project-request-types.component.html',
  styleUrl: './project-request-types.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectRequestTypesComponent {
  private readonly configService = inject(ConfigService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly projectKey = input.required<string>();

  readonly state = signal<ProjectRequestTypesState>('loading');
  readonly loadErrorMessage = signal<string | null>(null);
  readonly requestTypes = signal<ProjectRequestType[]>([]);

  readonly incorporating = signal(false);
  readonly incorporateErrorMessage = signal<string | null>(null);

  constructor() {
    effect(() => {
      const projectKey = this.projectKey();
      this.fetchRequestTypes(projectKey);
    });
  }

  retryLoad(): void {
    this.fetchRequestTypes(this.projectKey());
  }

  incorporate(): void {
    if (this.incorporating()) return;

    this.incorporating.set(true);
    this.incorporateErrorMessage.set(null);

    this.configService
      .configureRequestTypes(this.projectKey())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.configService
            .listProjectRequestTypes(this.projectKey())
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: (requestTypes) => {
                this.incorporating.set(false);
                this.requestTypes.set(requestTypes);
                this.snackBar.open('Tipos de solicitud incorporados', 'Cerrar', { duration: 4000 });
              },
              error: () => {
                this.incorporating.set(false);
                this.snackBar.open('Se incorporaron, pero no se pudo actualizar la lista. Recargá la sección.', 'Cerrar', {
                  duration: 5000,
                });
              },
            });
        },
        error: (error: unknown) => {
          this.incorporating.set(false);
          const result = classifyFormError(error);
          this.incorporateErrorMessage.set(result.message ?? GENERIC_ERROR_MESSAGE);
        },
      });
  }

  private fetchRequestTypes(projectKey: string): void {
    this.state.set('loading');
    this.loadErrorMessage.set(null);

    this.configService
      .listProjectRequestTypes(projectKey)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (requestTypes) => {
          this.requestTypes.set(requestTypes);
          this.state.set('loaded');
        },
        error: (error: unknown) => {
          const result = classifyFormError(error);
          this.loadErrorMessage.set(result.message ?? GENERIC_ERROR_MESSAGE);
          this.state.set('error');
        },
      });
  }
}
