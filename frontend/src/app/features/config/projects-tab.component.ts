import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { forkJoin } from 'rxjs';
import { ConfigService } from './config.service';
import { ConfigStatusService } from './config-status.service';
import { classifyFormError } from '../../shared/form-error';
import { AvailableProject } from '../../api/models/available-project';
import { Country } from '../../api/models/country';
import { OnboardedProject } from '../../api/models/onboarded-project';
import { AddProjectDialogComponent, AddProjectDialogData, AddProjectDialogResult } from './add-project-dialog.component';
import { ProjectActivationChange, ProjectThresholdsComponent } from './project-thresholds.component';
import { ProjectStatusesComponent } from './project-statuses.component';

export type ProjectsTabState = 'loading' | 'error' | 'loaded';

const LOAD_ERROR_MESSAGE = 'Ocurrió un error inesperado. Intentá de nuevo.';

@Component({
  selector: 'app-projects-tab',
  standalone: true,
  imports: [MatButtonModule, ProjectThresholdsComponent, ProjectStatusesComponent],
  templateUrl: './projects-tab.component.html',
  styleUrl: './projects-tab.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectsTabComponent {
  private readonly configService = inject(ConfigService);
  private readonly configStatus = inject(ConfigStatusService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly state = signal<ProjectsTabState>('loading');
  readonly loadErrorMessage = signal<string | null>(null);

  readonly onboardedProjects = signal<OnboardedProject[]>([]);
  readonly availableProjects = signal<AvailableProject[]>([]);
  readonly countries = signal<Country[]>([]);
  readonly selectedProjectKeyForStatuses = signal<string | null>(null);

  readonly availableToOnboard = computed(() => {
    const onboardedKeys = new Set(this.onboardedProjects().map((project) => project.key));
    return this.availableProjects().filter((project) => !onboardedKeys.has(project.key));
  });

  // Motivo por el que "Agregar proyecto" esta deshabilitado, o null si se
  // puede usar. Se chequea en este orden porque sin paises no hay forma de
  // completar el formulario, sin importar cuantos proyectos haya.
  readonly addProjectDisabledReason = computed(() => {
    if (this.countries().length === 0) return 'No hay países cargados: no se puede incorporar.';
    if (this.availableToOnboard().length === 0) return 'No hay proyectos nuevos para incorporar.';
    return null;
  });

  constructor() {
    this.fetchAll();
  }

  retryLoad(): void {
    this.fetchAll();
  }

  viewStatuses(projectKey: string): void {
    this.selectedProjectKeyForStatuses.set(projectKey);
  }

  openAddProjectDialog(): void {
    if (this.addProjectDisabledReason()) return;

    const dialogRef = this.dialog.open<AddProjectDialogComponent, AddProjectDialogData, AddProjectDialogResult>(
      AddProjectDialogComponent,
      {
        data: { availableProjects: this.availableToOnboard(), countries: this.countries() },
        disableClose: true,
        width: '640px',
        maxWidth: '92vw',
      },
    );

    dialogRef.afterClosed().subscribe((result) => {
      if (!result) return;
      this.onboardedProjects.set(result.projects);
      this.configStatus.setProjectsLoaded(result.projects);

      if (result.thresholdsSaved) {
        this.snackBar.open('Proyecto incorporado', 'Cerrar', { duration: 4000 });
      } else {
        this.snackBar.open(
          `${result.projectName} se agregó, pero los umbrales quedaron en los valores por defecto. Se pueden editar desde la tabla.`,
          'Cerrar',
          { duration: 6000 },
        );
      }
    });
  }

  // Refleja la activacion o desactivacion en la lista y en el estado
  // compartido, para que el centro de Configuracion lo muestre sin recargar.
  onActivationChanged(change: ProjectActivationChange): void {
    const updated = this.onboardedProjects().map((project) =>
      project.key === change.projectKey ? { ...project, is_active: change.isActive } : project,
    );
    this.onboardedProjects.set(updated);
    this.configStatus.setProjectsLoaded(updated);
  }

  onThresholdsSaved(): void {
    this.configService
      .listOnboardedProjects()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (projects) => {
          this.onboardedProjects.set(projects);
          this.snackBar.open('Umbrales guardados', 'Cerrar', { duration: 4000 });
        },
        error: () => {
          this.snackBar.open('No se pudo actualizar la lista de proyectos. Recargá la pestaña.', 'Cerrar', {
            duration: 4000,
          });
        },
      });
  }

  private fetchAll(): void {
    this.state.set('loading');
    this.loadErrorMessage.set(null);

    forkJoin({
      onboarded: this.configService.listOnboardedProjects(),
      available: this.configService.listAvailableProjects(),
      countries: this.configService.listCountries(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ onboarded, available, countries }) => {
          this.onboardedProjects.set(onboarded);
          this.availableProjects.set(available);
          this.countries.set(countries);
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
