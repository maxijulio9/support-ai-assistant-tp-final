import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ConfigService } from './config.service';
import { formSaveErrorMessage } from '../../shared/form-error';
import { firstResponseTargetError } from './first-response-target';
import { OnboardedProject } from '../../api/models/onboarded-project';

export interface EditThresholdsDialogData {
  project: OnboardedProject;
}

export type EditThresholdsDialogResult = boolean | undefined;

const SUBMIT_ERROR_MESSAGE = 'Ocurrió un error inesperado. Intentá de nuevo.';

// El umbral de revision no puede superar al de publicacion: si lo hiciera,
// el pipeline pediria revision humana para casos que ya alcanzaron la
// confianza minima para publicarse solo.
function needsReviewNotAboveAutoPublishValidator(control: AbstractControl): ValidationErrors | null {
  const parent = control.parent;
  if (!parent) return null;
  const autoPublish = parent.get('thresholdAutoPublish')?.value;
  if (typeof autoPublish !== 'number' || typeof control.value !== 'number') return null;
  return control.value <= autoPublish ? null : { aboveAutoPublish: true };
}

// Reusa las claves required, integer y min de firstResponseTargetError como
// errores del control, para que la plantilla los lea con hasError.
function firstResponseTargetValidator(control: AbstractControl): ValidationErrors | null {
  const error = firstResponseTargetError(control.value);
  return error ? { [error]: true } : null;
}

@Component({
  selector: 'app-edit-thresholds-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule],
  templateUrl: './edit-thresholds-dialog.component.html',
  styleUrl: './edit-thresholds-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditThresholdsDialogComponent {
  private readonly configService = inject(ConfigService);
  private readonly data = inject<EditThresholdsDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<EditThresholdsDialogComponent, EditThresholdsDialogResult>);
  private readonly destroyRef = inject(DestroyRef);

  readonly projectName = this.data.project.name;

  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = new FormGroup({
    thresholdAutoPublish: new FormControl(this.data.project.threshold_auto_publish, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0), Validators.max(1)],
    }),
    thresholdNeedsReview: new FormControl(this.data.project.threshold_needs_review, {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.min(0),
        Validators.max(1),
        needsReviewNotAboveAutoPublishValidator,
      ],
    }),
    similarityThreshold: new FormControl(this.data.project.similarity_threshold, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0), Validators.max(1)],
    }),
    firstResponseTarget: new FormControl(this.data.project.first_response_target_seconds, {
      nonNullable: true,
      validators: [firstResponseTargetValidator],
    }),
  });

  constructor() {
    // thresholdNeedsReview no se revalida solo porque thresholdAutoPublish
    // cambio (son controles hermanos, Angular no los enlaza automaticamente).
    this.form.controls.thresholdAutoPublish.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.form.controls.thresholdNeedsReview.updateValueAndValidity({ onlySelf: true }));
  }

  onSubmit(): void {
    if (this.submitting()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.errorMessage.set(null);
    this.submitting.set(true);
    this.form.disable();

    const { thresholdAutoPublish, thresholdNeedsReview, similarityThreshold, firstResponseTarget } =
      this.form.getRawValue();

    this.configService
      .configureProjectThresholds(this.data.project.key, {
        threshold_auto_publish: thresholdAutoPublish,
        threshold_needs_review: thresholdNeedsReview,
        similarity_threshold: similarityThreshold,
        first_response_target_seconds: firstResponseTarget,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.dialogRef.close(true);
        },
        error: (error: unknown) => {
          this.submitting.set(false);
          this.form.enable();
          this.errorMessage.set(formSaveErrorMessage(error, SUBMIT_ERROR_MESSAGE));
        },
      });
  }

  cancel(): void {
    if (this.submitting()) return;
    this.dialogRef.close(undefined);
  }
}
