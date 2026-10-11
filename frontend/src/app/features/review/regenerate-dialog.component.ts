import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { TimeoutError, map, timeout } from 'rxjs';
import { ReviewService } from './review.service';
import { classifyReviewError } from './review-errors';

export interface RegenerateDialogData {
  interactionId: string;
  reviewedBy: string | undefined;
  previousResponse: string | null;
}

export type RegenerateDialogResult = { actionType: string } | 'not-found' | 'timeout-refresh' | undefined;

// Tope de UX: el contrato no define maxLength para rejection_reason
// (backend/app/modules/internal_api/schemas.py, RegenerateRequest).
const REASON_MAX_LENGTH = 500;

const REGENERATE_TIMEOUT_MS = 30000;

@Component({
  selector: 'app-regenerate-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
  ],
  templateUrl: './regenerate-dialog.component.html',
  styleUrl: './regenerate-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegenerateDialogComponent {
  private readonly reviewService = inject(ReviewService);
  private readonly data = inject<RegenerateDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<RegenerateDialogComponent, RegenerateDialogResult>);
  private readonly destroyRef = inject(DestroyRef);

  // read: ElementRef es necesario porque #entendidoButton esta en un boton
  // con mat-flat-button: MatButton es un componente, no solo una directiva,
  // asi que sin read la referencia resuelve a la instancia de MatButton en
  // vez de al elemento nativo.
  private readonly resultTitle = viewChild('resultTitle', { read: ElementRef<HTMLElement> });
  private readonly entendidoButton = viewChild('entendidoButton', { read: ElementRef<HTMLButtonElement> });

  readonly reasonControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(REASON_MAX_LENGTH)],
  });
  readonly reasonMaxLength = REASON_MAX_LENGTH;
  readonly reasonLength = toSignal(this.reasonControl.valueChanges.pipe(map((value) => value.length)), {
    initialValue: 0,
  });
  readonly reasonInvalid = toSignal(
    this.reasonControl.statusChanges.pipe(map((status) => status !== 'VALID')),
    { initialValue: this.reasonControl.invalid },
  );

  readonly submitting = signal(false);
  readonly timedOut = signal(false);
  readonly errorMessage = signal<string | null>(null);

  // Cuando regenerate termina en ESCALATE, el dialogo no se cierra: pasa a
  // mostrar este resultado en vez del formulario.
  readonly resultState = signal<'form' | 'escalated'>('form');
  readonly escalatedDetailState = signal<'loading' | 'loaded' | 'error'>('loading');
  readonly escalatedResponseText = signal<string | null>(null);

  // Se compara con trim() porque el backend puede traer el mismo texto con
  // espacios/saltos de linea distintos sin que eso signifique que genero
  // contenido nuevo.
  readonly escalatedTextUnchanged = computed(() => {
    if (this.escalatedDetailState() !== 'loaded') return false;
    const current = (this.escalatedResponseText() ?? '').trim();
    const previous = (this.data.previousResponse ?? '').trim();
    return current === previous;
  });

  constructor() {
    // Al entrar al estado de resultado se mueve el foco: mientras el texto
    // todavia se esta pidiendo, al titulo (para que se anuncie el cambio de
    // contenido); una vez que termina de cargar, al boton "Entendido".
    effect(() => {
      if (this.resultState() !== 'escalated') return;
      const loading = this.escalatedDetailState() === 'loading';
      const target = loading ? this.resultTitle() : this.entendidoButton();
      target?.nativeElement.focus();
    });
  }

  confirm(): void {
    if (this.reasonControl.invalid || this.submitting()) return;

    this.submitting.set(true);
    this.timedOut.set(false);
    this.errorMessage.set(null);
    this.reasonControl.disable();

    this.reviewService
      .regenerate(this.data.interactionId, this.reasonControl.value, this.data.reviewedBy)
      .pipe(timeout(REGENERATE_TIMEOUT_MS), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.submitting.set(false);
          // backend/app/modules/response_generator/service.py:99-101 fuerza
          // ESCALATE cuando la respuesta regenerada seguiria en NEEDS_REVIEW
          // (ahi SI hay texto nuevo, de baja confianza). El mismo metodo,
          // lineas 82-89, tambien escala si fallo la llamada al LLM, pero
          // ahi response_text nunca se asigna y generated_response en la
          // base queda igual (COALESCE conserva el texto anterior). La
          // respuesta de la API no distingue los dos casos, por eso se pide
          // el detalle y se compara contra el texto previo.
          if (response.action_type === 'ESCALATE') {
            this.handleEscalated();
            return;
          }
          this.dialogRef.close({ actionType: response.action_type });
        },
        error: (error: unknown) => {
          this.submitting.set(false);
          if (error instanceof TimeoutError) {
            // No reintentamos el POST: el servidor puede seguir procesando
            // la regeneracion aunque el cliente corte la espera aca. La
            // unica salida es actualizar la cola, nunca volver a enviar.
            this.timedOut.set(true);
            return;
          }

          const category = classifyReviewError(error);
          if (category === 'not-found') {
            this.dialogRef.close('not-found');
            return;
          }

          this.reasonControl.enable();
          if (category === 'forbidden') {
            this.errorMessage.set('No tenés permisos para regenerar esta respuesta.');
          } else if (category === 'validation') {
            this.errorMessage.set('Revisá los datos ingresados.');
          } else {
            this.errorMessage.set('No se pudo regenerar la respuesta. Intentá de nuevo.');
          }
        },
      });
  }

  private handleEscalated(): void {
    this.resultState.set('escalated');
    this.escalatedDetailState.set('loading');

    this.reviewService
      .getDetail(this.data.interactionId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (detail) => {
          this.escalatedResponseText.set(detail.generated_response ?? null);
          this.escalatedDetailState.set('loaded');
        },
        error: () => {
          this.escalatedDetailState.set('error');
        },
      });
  }

  acknowledgeEscalated(): void {
    this.dialogRef.close({ actionType: 'ESCALATE' });
  }

  updateQueueAfterTimeout(): void {
    this.dialogRef.close('timeout-refresh');
  }

  cancel(): void {
    if (this.submitting()) return;
    this.dialogRef.close(undefined);
  }
}
