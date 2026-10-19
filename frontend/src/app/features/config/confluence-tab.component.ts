import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { ConfigService } from './config.service';
import { classifyFormError } from '../../shared/form-error';
import { resolveSelectedProjectKey } from './project-selection';
import { OnboardedProject } from '../../api/models/onboarded-project';
import { ConfluenceConnectionComponent } from './confluence-connection.component';
import { ProjectSpacesComponent } from './project-spaces.component';

export type ConfluenceTabState = 'loading' | 'error' | 'loaded';

const LOAD_ERROR_MESSAGE = 'Ocurrió un error inesperado. Intentá de nuevo.';

@Component({
  selector: 'app-confluence-tab',
  standalone: true,
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    ConfluenceConnectionComponent,
    ProjectSpacesComponent,
  ],
  templateUrl: './confluence-tab.component.html',
  styleUrl: './confluence-tab.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfluenceTabComponent {
  private readonly configService = inject(ConfigService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly state = signal<ConfluenceTabState>('loading');
  readonly loadErrorMessage = signal<string | null>(null);
  readonly projects = signal<OnboardedProject[]>([]);

  // Mismo query param (?project=) que usa la pestaña de Campos y
  // categorías: la seleccion viaja entre las dos.
  private readonly projectParam = toSignal(this.route.queryParamMap.pipe(map((params) => params.get('project'))), {
    initialValue: this.route.snapshot.queryParamMap.get('project'),
  });

  readonly selectedProjectKey = computed(() =>
    resolveSelectedProjectKey(this.projects().map((project) => project.key), this.projectParam()),
  );

  constructor() {
    this.fetchProjects();
  }

  retryLoad(): void {
    this.fetchProjects();
  }

  selectProject(projectKey: string): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { project: projectKey },
      queryParamsHandling: 'merge',
    });
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
