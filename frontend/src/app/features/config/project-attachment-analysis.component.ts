import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { MatSlideToggle, MatSlideToggleChange, MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { timer } from 'rxjs';
import { OnboardedProject } from '../../api/models/onboarded-project';
import {
  ATTACHMENT_ANALYSIS_PARAGRAPHS,
  ATTACHMENT_ANALYSIS_TITLE,
  AttachmentAnalysisKeyState,
  IDLE_ATTACHMENT_ANALYSIS_STATE,
  attachmentAnalysisActionFor,
  attachmentAnalysisErrorMessage,
  attachmentAnalysisSnackbarMessage,
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
// Despues de terminar, la llave sigue bloqueada un instante: un doble clic cuyo
// segundo clic llega con la respuesta ya recibida no dispara otro pedido.
const SETTLE_MS = 600;

@Component({
  selector: 'app-project-attachment-analysis',
  standalone: true,
  imports: [MatSlideToggleModule],
  templateUrl: './project-attachment-analysis.component.html',
  styleUrl: './project-attachment-analysis.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectAttachmentAnalysisComponent {
  private readonly dialog = inject(MatDialog);
  private readonly configService = inject(ConfigService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  // El proyecto elegido en "Ver estados". Su valor guardado viene de la lista
  // compartida, que se actualiza al guardar.
  readonly project = input.required<OnboardedProject>();
  readonly changed = output<AttachmentAnalysisChange>();

  readonly title = ATTACHMENT_ANALYSIS_TITLE;
  readonly paragraphs = ATTACHMENT_ANALYSIS_PARAGRAPHS;

  // Lo que esta pasando con la llave de cada proyecto: el pedido en curso, el
  // bloqueo y el error. Va por proyecto para que, al cambiar de proyecto, no
  // se arrastre el estado de guardado ni el error del anterior, y para que la
  // respuesta tardia de un proyecto no toque la pantalla del actual.
  private readonly states = signal<Record<string, AttachmentAnalysisKeyState>>({});
  private confirming = false;
  private readonly slideToggle = viewChild(MatSlideToggle);

  readonly current = computed(() => this.states()[this.project().key] ?? IDLE_ATTACHMENT_ANALYSIS_STATE);
  readonly toggle = computed(() => attachmentAnalysisToggleState(this.project().analyze_attachments_enabled, this.current()));

  constructor() {
    // Al cambiar de proyecto se limpian los errores
    effect(() => {
      this.project().key;
      untracked(() => {
        this.states.update((all) =>
          Object.fromEntries(Object.entries(all).map(([key, state]) => [key, { ...state, error: null }])),
        );
      });
    });
  }

  onToggle(event: MatSlideToggleChange): void {
    const project = this.project();
    const saved = project.analyze_attachments_enabled;

    // Bloqueada o con la confirmacion abierta: la llave vuelve a como esta
    if (this.current().locked || this.confirming) {
      event.source.checked = this.toggle().checked;
      return;
    }

    const action = attachmentAnalysisActionFor(saved, event.checked);
    if (action === 'none') return;

    if (action === 'ask-confirmation') {
      // La llave no queda movida hasta que se confirme
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
    const key = project.key;
    this.update(key, { desired: enabled, locked: true, error: null });

    this.configService
      .setAttachmentAnalysis(key, enabled)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.update(key, { desired: null, locked: true, error: null });
          this.changed.emit({ projectKey: key, enabled: response.analyze_attachments_enabled });
          this.snackBar.open(attachmentAnalysisSnackbarMessage(response.analyze_attachments_enabled, project.name), 'Cerrar', {
            duration: SNACKBAR_MS,
          });
          this.releaseAfterSettle(key);
        },
        error: (error: unknown) => {
          // Vuelve al valor guardado y muestra el motivo debajo de la llave
          this.update(key, { desired: null, locked: true, error: attachmentAnalysisErrorMessage(error) });
          this.syncToggle();
          this.releaseAfterSettle(key);
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

  private releaseAfterSettle(key: string): void {
    timer(SETTLE_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.update(key, { ...(this.states()[key] ?? IDLE_ATTACHMENT_ANALYSIS_STATE), locked: false }));
  }

  private update(key: string, state: AttachmentAnalysisKeyState): void {
    this.states.update((all) => ({ ...all, [key]: state }));
  }
}
