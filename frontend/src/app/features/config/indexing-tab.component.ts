import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { ConfigService } from './config.service';
import { classifyFormError } from '../../shared/form-error';
import { configProjectLabel } from './project-activation';
import { resolveSelectedProjectKey } from './project-selection';
import { OnboardedProject } from '../../api/models/onboarded-project';
import { IndexingStatusComponent } from './indexing-status.component';
import { IndexedSpacesComponent } from './indexed-spaces.component';

export type IndexingTabState = 'loading' | 'error' | 'loaded';
export type LinkedSpacesState = 'loading' | 'error' | 'loaded';

const GENERIC_ERROR_MESSAGE = 'Ocurrió un error inesperado. Intentá de nuevo.';

@Component({
  selector: 'app-indexing-tab',
  standalone: true,
  imports: [MatButtonModule, MatFormFieldModule, MatSelectModule, IndexingStatusComponent, IndexedSpacesComponent],
  templateUrl: './indexing-tab.component.html',
  styleUrl: './indexing-tab.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IndexingTabComponent {
  private readonly configService = inject(ConfigService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly statusComponent = viewChild(IndexingStatusComponent);

  readonly state = signal<IndexingTabState>('loading');
  readonly loadErrorMessage = signal<string | null>(null);
  readonly projects = signal<OnboardedProject[]>([]);
  readonly projectLabel = configProjectLabel;

  // Mismo query param (?project=) que Campos y categorías y Confluence.
  private readonly projectParam = toSignal(this.route.queryParamMap.pipe(map((params) => params.get('project'))), {
    initialValue: this.route.snapshot.queryParamMap.get('project'),
  });

  readonly selectedProjectKey = computed(() =>
    resolveSelectedProjectKey(this.projects().map((project) => project.key), this.projectParam()),
  );

  readonly linkedSpacesState = signal<LinkedSpacesState>('loading');
  readonly linkedSpaceKeys = signal<string[]>([]);
  readonly selectedSpaceKeys = signal<string[]>([]);

  readonly submitting = signal(false);
  readonly submitErrorMessage = signal<string | null>(null);

  readonly canStart = computed(
    () => this.selectedSpaceKeys().length > 0 && !this.submitting() && !this.statusComponent()?.isInProgress(),
  );

  constructor() {
    this.fetchProjects();

    effect(() => {
      const projectKey = this.selectedProjectKey();
      if (projectKey) this.fetchLinkedSpaces(projectKey);
    });
  }

  retryLoad(): void {
    this.fetchProjects();
  }

  retryLinkedSpaces(): void {
    const projectKey = this.selectedProjectKey();
    if (projectKey) this.fetchLinkedSpaces(projectKey);
  }

  selectProject(projectKey: string): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { project: projectKey },
      queryParamsHandling: 'merge',
    });
  }

  selectSpaces(spaceKeys: string[]): void {
    this.selectedSpaceKeys.set(spaceKeys);
  }

  onStart(): void {
    if (!this.canStart()) return;

    // Se lee antes de vaciar selectedSpaceKeys: notifyStarted la necesita
    // para completar el estado optimista (ver buildOptimisticIndexingStatus).
    const spaceKeys = this.selectedSpaceKeys();

    this.submitting.set(true);
    this.submitErrorMessage.set(null);

    this.configService
      .startIndexing(spaceKeys)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.submitting.set(false);
          this.selectedSpaceKeys.set([]);
          this.statusComponent()?.notifyStarted(response, spaceKeys);
        },
        error: (error: unknown) => {
          this.submitting.set(false);
          const result = classifyFormError(error);
          this.submitErrorMessage.set(result.message ?? GENERIC_ERROR_MESSAGE);
        },
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
          this.loadErrorMessage.set(result.message ?? GENERIC_ERROR_MESSAGE);
          this.state.set('error');
        },
      });
  }

  private fetchLinkedSpaces(projectKey: string): void {
    this.linkedSpacesState.set('loading');
    this.selectedSpaceKeys.set([]);

    this.configService
      .getProjectConfiguration(projectKey)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (detail) => {
          this.linkedSpaceKeys.set(
            detail.spaces.filter((space) => space.is_active).map((space) => space.space_key),
          );
          this.linkedSpacesState.set('loaded');
        },
        error: () => {
          this.linkedSpaceKeys.set([]);
          this.linkedSpacesState.set('error');
        },
      });
  }
}
