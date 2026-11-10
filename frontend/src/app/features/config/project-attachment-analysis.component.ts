import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ACTIVATE_TO_EDIT_HINT, isProjectEditable } from '../../shared/project-activity';
import { MatSlideToggle, MatSlideToggleChange, MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { timer } from 'rxjs';
import { OnboardedProject } from '../../api/models/onboarded-project';
import {
  AttachmentAnalysisKeyState,
  IDLE_ATTACHMENT_ANALYSIS_STATE,
  attachmentAnalysisActionFor,
  attachmentAnalysisErrorMessage,
  attachmentAnalysisSnackbarMessage,
  attachmentAnalysisToggleLabel,
  attachmentAnalysisToggleState,
} from './attachment-analysis';
import {
  AttachmentAnalysisDialogComponent,
  AttachmentAnalysisDialogData,
  AttachmentAnalysisDialogResult,
} from './attachment-analysis-dialog.component';
import { ConfigService } from './config.service';

export interface AttachmentAnalysisChange {
  projectKey: string;
  enabled: boolean;
}

const SNACKBAR_MS = 4000;
const ERROR_SNACKBAR_MS = 7000;
// Despues de terminar, la llave sigue bloqueada un instante: un doble clic cuyo
// segundo clic llega con la respuesta ya recibida no dispara otro pedido.
const SETTLE_MS = 600;

// Interruptor de una fila de la tabla de proyectos. Su valor guardado viene de
// la lista compartida, que se actualiza al guardar. Cada fila tiene su propia
// instancia, asi que el estado de guardado no se mezcla entre proyectos.
@Component({
  selector: 'app-project-attachment-analysis',
  standalone: true,
  imports: [MatSlideToggleModule, MatTooltipModule],
  template: `
    <mat-slide-toggle
      [checked]="toggle().checked"
      [disabled]="toggle().disabled || !editable()"
      [disabledInteractive]="!editable()"
      [matTooltip]="editable() ? '' : blockedHint"
      [aria-label]="label()"
      (change)="onToggle($event)"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectAttachmentAnalysisComponent {
  private readonly dialog = inject(MatDialog);
  private readonly configService = inject(ConfigService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly project = input.required<OnboardedProject>();
  readonly changed = output<AttachmentAnalysisChange>();

  private readonly state = signal<AttachmentAnalysisKeyState>(IDLE_ATTACHMENT_ANALYSIS_STATE);
  private confirming = false;
  private readonly slideToggle = viewChild(MatSlideToggle);

  readonly toggle = computed(() => attachmentAnalysisToggleState(this.project().analyze_attachments_enabled, this.state()));
  readonly editable = computed(() => isProjectEditable(this.project()));
  readonly blockedHint = ACTIVATE_TO_EDIT_HINT;
  readonly label = computed(() => attachmentAnalysisToggleLabel(this.project().name));

  onToggle(event: MatSlideToggleChange): void {
    const project = this.project();
    const saved = project.analyze_attachments_enabled;

    // Bloqueada o con la confirmacion abierta: la llave vuelve a como esta
    if (this.state().locked || this.confirming || !this.editable()) {
      event.source.checked = this.toggle().checked;
      return;
    }

    const action = attachmentAnalysisActionFor(saved, event.checked);
    if (action === 'none') return;

    if (action === 'ask-confirmation') {
      // La llave no se mueve hasta que se confirme
      event.source.checked = saved;
      this.askConfirmation(project);
      return;
    }

    this.save(project, event.checked);
  }

  private askConfirmation(project: OnboardedProject): void {
    this.confirming = true;
    this.dialog
      .open<AttachmentAnalysisDialogComponent, AttachmentAnalysisDialogData, AttachmentAnalysisDialogResult>(
        AttachmentAnalysisDialogComponent,
        { data: { projectName: project.name }, width: '560px', maxWidth: '92vw' },
      )
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((confirmed) => {
        this.confirming = false;
        if (confirmed === true) this.save(project, true);
      });
  }

  private save(project: OnboardedProject, enabled: boolean): void {
    this.state.set({ desired: enabled, locked: true });

    this.configService
      .setAttachmentAnalysis(project.key, enabled)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.state.set({ desired: null, locked: true });
          this.changed.emit({ projectKey: project.key, enabled: response.analyze_attachments_enabled });
          this.snackBar.open(attachmentAnalysisSnackbarMessage(response.analyze_attachments_enabled, project.name), 'Cerrar', {
            duration: SNACKBAR_MS,
          });
          this.releaseAfterSettle();
        },
        error: (error: unknown) => {
          // Vuelve al valor guardado y avisa el motivo
          this.state.set({ desired: null, locked: true });
          this.syncToggle();
          this.snackBar.open(attachmentAnalysisErrorMessage(error), 'Cerrar', { duration: ERROR_SNACKBAR_MS });
          this.releaseAfterSettle();
        },
      });
  }

  // La llave se movio al hacer clic. Si el pedido falla antes de que Angular
  // llegue a mostrar el valor pedido (una falla inmediata), el valor guardado
  // no cambia y Angular no la vuelve a escribir sola: se le pone el valor a mano.
  private syncToggle(): void {
    const toggle = this.slideToggle();
    if (toggle) toggle.checked = this.toggle().checked;
  }

  private releaseAfterSettle(): void {
    timer(SETTLE_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.state.update((state) => ({ ...state, locked: false })));
  }
}
