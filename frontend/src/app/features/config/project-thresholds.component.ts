import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { timer } from 'rxjs';
import { OnboardedProject } from '../../api/models/onboarded-project';
import { ConfigService } from './config.service';
import {
  DeactivateProjectDialogComponent,
  DeactivateProjectDialogData,
  DeactivateProjectDialogResult,
} from './deactivate-project-dialog.component';
import {
  EditThresholdsDialogComponent,
  EditThresholdsDialogData,
  EditThresholdsDialogResult,
} from './edit-thresholds-dialog.component';
import { formatFirstResponseTarget } from './first-response-target';
import {
  ActivationKind,
  activationAction,
  activationErrorMessage,
  activationSnackbarMessage,
} from './project-activation';
import { isProjectActive } from '../../shared/project-activity';

export interface ProjectActivationChange {
  projectKey: string;
  isActive: boolean;
}

const SNACKBAR_MS = 4000;
const ERROR_SNACKBAR_MS = 7000;
// Despues de terminar, el boton sigue bloqueado un instante: un doble clic cuyo
// segundo clic llega con la respuesta ya recibida no dispara otro pedido ni
// cae sobre el boton con la accion contraria.
const SETTLE_MS = 600;

@Component({
  selector: 'app-project-thresholds',
  standalone: true,
  imports: [MatButtonModule],
  templateUrl: './project-thresholds.component.html',
  styleUrl: './project-thresholds.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectThresholdsComponent {
  private readonly dialog = inject(MatDialog);
  private readonly configService = inject(ConfigService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly projects = input.required<OnboardedProject[]>();
  readonly selectedProjectKey = input<string | null>(null);

  readonly formatFirstResponseTarget = formatFirstResponseTarget;
  readonly isActive = isProjectActive;
  readonly actionOf = activationAction;

  readonly viewStatuses = output<string>();
  readonly thresholdsSaved = output<void>();
  readonly activationChanged = output<ProjectActivationChange>();

  // Proyectos con un pedido de activacion o desactivacion en curso (y el
  // instante posterior). Mientras esta la clave, el boton queda bloqueado y
  // un doble clic no dispara dos pedidos.
  private readonly pendingKeys = signal<ReadonlySet<string>>(new Set());

  // Proyectos con la confirmacion abierta. No bloquea el boton (para que el
  // foco vuelva a el al cerrar el dialogo) pero evita abrir dos dialogos.
  private readonly confirmingKeys = new Set<string>();

  isPending(projectKey: string): boolean {
    return this.pendingKeys().has(projectKey);
  }

  openEditThresholds(project: OnboardedProject): void {
    const dialogRef = this.dialog.open<EditThresholdsDialogComponent, EditThresholdsDialogData, EditThresholdsDialogResult>(
      EditThresholdsDialogComponent,
      { data: { project }, disableClose: true, width: '640px', maxWidth: '92vw' },
    );

    dialogRef.afterClosed().subscribe((saved) => {
      if (!saved) return;
      this.thresholdsSaved.emit();
    });
  }

  toggleActivation(project: OnboardedProject): void {
    if (this.isPending(project.key) || this.confirmingKeys.has(project.key)) return;

    const action = activationAction(project);

    if (!action.needsConfirmation) {
      this.runActivation(project, action.kind);
      return;
    }

    this.confirmingKeys.add(project.key);
    this.dialog
      .open<DeactivateProjectDialogComponent, DeactivateProjectDialogData, DeactivateProjectDialogResult>(
        DeactivateProjectDialogComponent,
        { data: { projectName: project.name }, width: '440px', maxWidth: '92vw' },
      )
      .afterClosed()
      .subscribe((confirmed) => {
        this.confirmingKeys.delete(project.key);
        if (confirmed === true) this.runActivation(project, action.kind);
      });
  }

  private runActivation(project: OnboardedProject, kind: ActivationKind): void {
    this.markPending(project.key, true);

    const request$ =
      kind === 'deactivate' ? this.configService.deactivateProject(project.key) : this.configService.activateProject(project.key);

    request$.subscribe({
      next: (response) => {
        this.releaseAfterSettle(project.key);
        this.activationChanged.emit({ projectKey: project.key, isActive: response.is_active });
        this.snackBar.open(activationSnackbarMessage(kind, project.name, response.pending_reviews), 'Cerrar', {
          duration: SNACKBAR_MS,
        });
      },
      error: (error: unknown) => {
        this.releaseAfterSettle(project.key);
        this.snackBar.open(activationErrorMessage(error, kind), 'Cerrar', { duration: ERROR_SNACKBAR_MS });
      },
    });
  }

  private releaseAfterSettle(projectKey: string): void {
    timer(SETTLE_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.markPending(projectKey, false));
  }

  private markPending(projectKey: string, pending: boolean): void {
    this.pendingKeys.update((keys) => {
      const next = new Set(keys);
      if (pending) next.add(projectKey);
      else next.delete(projectKey);
      return next;
    });
  }
}
