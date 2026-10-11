import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { TimeoutError, map, timeout } from 'rxjs';
import { ReviewService } from './review.service';
import { classifyReviewError } from './review-errors';

export interface RejectDialogData {
  interactionId: string;
  reviewedBy: string | undefined;
}

export type RejectDialogResult = 'success' | 'not-found' | 'timeout-refresh' | undefined;

// Tope de UX: el contrato no define maxLength para rejection_reason
// (backend/app/modules/internal_api/schemas.py, RegenerateRequest).
const REASON_MAX_LENGTH = 500;

const REGENERATE_TIMEOUT_MS = 30000;

@Component({
  selector: 'app-reject-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
  ],
  templateUrl: './reject-dialog.component.html',
  styleUrl: './reject-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RejectDialogComponent {
  private readonly reviewService = inject(ReviewService);
  private readonly data = inject<RejectDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<RejectDialogComponent, RejectDialogResult>);

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

  confirm(): void {
    if (this.reasonControl.invalid || this.submitting()) return;

    this.submitting.set(true);
    this.timedOut.set(false);
    this.errorMessage.set(null);
    this.reasonControl.disable();

    this.reviewService
      .regenerate(this.data.interactionId, this.reasonControl.value, this.data.reviewedBy)
      .pipe(timeout(REGENERATE_TIMEOUT_MS))
      .subscribe({
        next: () => {
          this.dialogRef.close('success');
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
            this.errorMessage.set('No tenés permisos para rechazar esta respuesta.');
          } else if (category === 'validation') {
            this.errorMessage.set('Revisá los datos ingresados.');
          } else {
            this.errorMessage.set('No se pudo enviar el rechazo. Intentá de nuevo.');
          }
        },
      });
  }

  updateQueueAfterTimeout(): void {
    this.dialogRef.close('timeout-refresh');
  }

  cancel(): void {
    if (this.submitting()) return;
    this.dialogRef.close(undefined);
  }
}
