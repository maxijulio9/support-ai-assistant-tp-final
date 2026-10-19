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
import { MatSelectModule } from '@angular/material/select';
import { ConfigService } from './config.service';
import { classifyFormError } from '../../shared/form-error';
import { AvailableProject } from '../../api/models/available-project';
import { Country } from '../../api/models/country';
import { OnboardedProject } from '../../api/models/onboarded-project';

export interface AddProjectDialogData {
  availableProjects: AvailableProject[];
  countries: Country[];
}

export interface AddProjectDialogResult {
  projects: OnboardedProject[];
  thresholdsSaved: boolean;
  projectName: string;
}

const SUBMIT_ERROR_MESSAGE = 'Ocurrió un error inesperado. Intentá de nuevo.';
const CONFIRM_ERROR_MESSAGE = 'No se pudo confirmar el alta, intentá de nuevo.';

// Mismos defaults que el schema del contrato (ProjectThresholds).
const DEFAULT_THRESHOLD_AUTO_PUBLISH = 0.85;
const DEFAULT_THRESHOLD_NEEDS_REVIEW = 0.6;
const DEFAULT_SIMILARITY_THRESHOLD = 0.4;

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

@Component({
  selector: 'app-add-project-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './add-project-dialog.component.html',
  styleUrl: './add-project-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddProjectDialogComponent {
  private readonly configService = inject(ConfigService);
  private readonly data = inject<AddProjectDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<AddProjectDialogComponent, AddProjectDialogResult | undefined>);
  private readonly destroyRef = inject(DestroyRef);

  readonly availableProjects = this.data.availableProjects;
  readonly countries = this.data.countries;

  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = new FormGroup({
    projectKey: new FormControl<string | null>(null, { validators: [Validators.required] }),
    countryCode: new FormControl<string | null>(null, { validators: [Validators.required] }),
    thresholdAutoPublish: new FormControl(DEFAULT_THRESHOLD_AUTO_PUBLISH, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0), Validators.max(1)],
    }),
    thresholdNeedsReview: new FormControl(DEFAULT_THRESHOLD_NEEDS_REVIEW, {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.min(0),
        Validators.max(1),
        needsReviewNotAboveAutoPublishValidator,
      ],
    }),
    similarityThreshold: new FormControl(DEFAULT_SIMILARITY_THRESHOLD, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0), Validators.max(1)],
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

    const { projectKey, countryCode, thresholdAutoPublish, thresholdNeedsReview, similarityThreshold } =
      this.form.getRawValue();
    const key = projectKey as string;
    const project = this.availableProjects.find((candidate) => candidate.key === key);

    this.configService
      .onboardProjects([{ code: key, name: project?.name ?? key, country_code: countryCode as string }])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.confirmAndConfigureThresholds(key, {
          threshold_auto_publish: thresholdAutoPublish,
          threshold_needs_review: thresholdNeedsReview,
          similarity_threshold: similarityThreshold,
        }),
        error: (error: unknown) => this.handleError(error),
      });
  }

  cancel(): void {
    if (this.submitting()) return;
    this.dialogRef.close(undefined);
  }

  // Antes de mandar los umbrales, se confirma contra la lista real que el
  // proyecto efectivamente quedo incorporado: projects_created no distingue
  // "creado" de "actualizado", asi que no alcanza por si solo.
  private confirmAndConfigureThresholds(key: string, thresholds: {
    threshold_auto_publish: number;
    threshold_needs_review: number;
    similarity_threshold: number;
  }): void {
    this.configService
      .listOnboardedProjects()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (projects) => {
          const onboardedProject = projects.find((project) => project.key === key);
          if (!onboardedProject) {
            this.submitting.set(false);
            this.form.enable();
            this.errorMessage.set(CONFIRM_ERROR_MESSAGE);
            return;
          }

          this.configService
            .configureProjectThresholds(key, thresholds)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: () => {
                this.submitting.set(false);
                this.dialogRef.close({ projects, thresholdsSaved: true, projectName: onboardedProject.name });
              },
              error: () => {
                this.submitting.set(false);
                this.dialogRef.close({ projects, thresholdsSaved: false, projectName: onboardedProject.name });
              },
            });
        },
        error: (error: unknown) => this.handleError(error),
      });
  }

  private handleError(error: unknown): void {
    this.submitting.set(false);
    this.form.enable();
    const result = classifyFormError(error);
    this.errorMessage.set(result.message ?? SUBMIT_ERROR_MESSAGE);
  }
}
