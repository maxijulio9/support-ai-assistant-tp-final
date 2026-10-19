import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { forkJoin } from 'rxjs';
import { ConfigService } from './config.service';
import { classifyFormError } from '../../shared/form-error';
import { AvailableRequestType } from '../../api/models/available-request-type';
import { ProjectRequestType } from '../../api/models/project-request-type';

export type ProjectRequestTypesState = 'loading' | 'error' | 'loaded';

const GENERIC_ERROR_MESSAGE = 'Ocurrió un error inesperado. Intentá de nuevo.';

@Component({
  selector: 'app-project-request-types',
  standalone: true,
  imports: [MatButtonModule, MatFormFieldModule, MatSelectModule],
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

  readonly availableRequestTypes = signal<AvailableRequestType[]>([]);
  readonly incorporatedRequestTypes = signal<ProjectRequestType[]>([]);

  readonly selectedRequestTypeId = signal<string | null>(null);
  readonly submitting = signal(false);
  readonly submitErrorMessage = signal<string | null>(null);

  // Las ya incorporadas tambien se listan (deshabilitadas) para que el
  // admin vea de un vistazo cuales son, no solo las elegibles.
  readonly hasEligible = computed(() => this.availableRequestTypes().some((requestType) => !requestType.incorporated));

  readonly canSubmit = computed(() => !!this.selectedRequestTypeId() && !this.submitting());

  constructor() {
    effect(() => {
      const projectKey = this.projectKey();
      this.fetchAll(projectKey);
    });
  }

  retryLoad(): void {
    this.fetchAll(this.projectKey());
  }

  selectRequestType(requestTypeId: string): void {
    this.selectedRequestTypeId.set(requestTypeId);
  }

  onAdd(): void {
    const requestTypeId = this.selectedRequestTypeId();
    if (!this.canSubmit() || !requestTypeId) return;

    this.submitting.set(true);
    this.submitErrorMessage.set(null);

    this.configService
      .addProjectRequestType(this.projectKey(), requestTypeId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.refreshAfterAdd(),
        error: (error: unknown) => {
          this.submitting.set(false);
          const result = classifyFormError(error);
          this.submitErrorMessage.set(result.message ?? GENERIC_ERROR_MESSAGE);
        },
      });
  }

  private refreshAfterAdd(): void {
    forkJoin({
      available: this.configService.listAvailableRequestTypes(this.projectKey()),
      incorporated: this.configService.listProjectRequestTypes(this.projectKey()),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ available, incorporated }) => {
          this.submitting.set(false);
          this.availableRequestTypes.set(available);
          this.incorporatedRequestTypes.set(incorporated);
          this.selectedRequestTypeId.set(null);
          this.snackBar.open('Tipo de solicitud agregado', 'Cerrar', { duration: 4000 });
        },
        error: () => {
          this.submitting.set(false);
          this.selectedRequestTypeId.set(null);
          this.snackBar.open('Se agregó, pero no se pudo actualizar la lista. Recargá la sección.', 'Cerrar', {
            duration: 5000,
          });
        },
      });
  }

  private fetchAll(projectKey: string): void {
    this.state.set('loading');
    this.loadErrorMessage.set(null);
    this.selectedRequestTypeId.set(null);

    forkJoin({
      available: this.configService.listAvailableRequestTypes(projectKey),
      incorporated: this.configService.listProjectRequestTypes(projectKey),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ available, incorporated }) => {
          this.availableRequestTypes.set(available);
          this.incorporatedRequestTypes.set(incorporated);
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
