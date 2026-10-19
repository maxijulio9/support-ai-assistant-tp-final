import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { ConfigService } from './config.service';
import { classifyFormError } from '../../shared/form-error';
import { OnboardedProject } from '../../api/models/onboarded-project';
import { ProjectCategoriesComponent } from './project-categories.component';

export type FieldsCategoriesTabState = 'loading' | 'error' | 'loaded';

const LOAD_ERROR_MESSAGE = 'Ocurrió un error inesperado. Intentá de nuevo.';

@Component({
  selector: 'app-fields-categories-tab',
  standalone: true,
  imports: [MatButtonModule, MatFormFieldModule, MatSelectModule, ProjectCategoriesComponent],
  templateUrl: './fields-categories-tab.component.html',
  styleUrl: './fields-categories-tab.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FieldsCategoriesTabComponent {
  private readonly configService = inject(ConfigService);
  private readonly destroyRef = inject(DestroyRef);

  readonly state = signal<FieldsCategoriesTabState>('loading');
  readonly loadErrorMessage = signal<string | null>(null);
  readonly projects = signal<OnboardedProject[]>([]);
  readonly selectedProjectKey = signal<string | null>(null);

  constructor() {
    this.fetchProjects();
  }

  retryLoad(): void {
    this.fetchProjects();
  }

  selectProject(projectKey: string): void {
    this.selectedProjectKey.set(projectKey);
  }

  private fetchProjects(): void {
    this.state.set('loading');
    this.loadErrorMessage.set(null);

    this.configService
      .listOnboardedProjects()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (projects) => {
          this.projects.set(projects);
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
