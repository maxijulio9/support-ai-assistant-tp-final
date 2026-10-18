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
import { HttpErrorResponse } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { UsersService } from './users.service';
import { classifyFormError } from '../../shared/form-error';
import { roleLabel } from '../../shared/role-label';
import { UserResponse } from '../../api/models/user-response';

export type CreateUserDialogResult = UserResponse | undefined;

const SUBMIT_ERROR_MESSAGE = 'Ocurrió un error inesperado. Intentá de nuevo.';
const EMAIL_TAKEN_MESSAGE = 'El email ya está registrado.';
const NAME_MAX_LENGTH = 255;

// Mismo criterio que shared/role-label.ts: tope propio, no declarado en el contrato.

function passwordsMatchValidator(control: AbstractControl): ValidationErrors | null {
  const parent = control.parent;
  if (!parent) return null;
  return control.value === parent.get('password')?.value ? null : { passwordsMismatch: true };
}

@Component({
  selector: 'app-create-user-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './create-user-dialog.component.html',
  styleUrl: './create-user-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateUserDialogComponent {
  private readonly usersService = inject(UsersService);
  private readonly dialogRef = inject(MatDialogRef<CreateUserDialogComponent, CreateUserDialogResult>);
  private readonly destroyRef = inject(DestroyRef);

  readonly roleLabel = roleLabel;
  readonly roleOptions: ReadonlyArray<'admin' | 'agent'> = ['agent', 'admin'];

  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly emailServerMessage = signal<string | null>(null);

  readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    fullName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(NAME_MAX_LENGTH)],
    }),
    // Agente por defecto: el admin tiene que elegir explicitamente "Administrador".
    role: new FormControl<'admin' | 'agent'>('agent', { nonNullable: true, validators: [Validators.required] }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(8), Validators.maxLength(72)],
    }),
    confirmPassword: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, passwordsMatchValidator],
    }),
  });

  constructor() {
    // confirmPassword no se revalida solo porque password cambio (son
    // controles hermanos, Angular no los enlaza automaticamente).
    this.form.controls.password.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.form.controls.confirmPassword.updateValueAndValidity({ onlySelf: true }));

    // El error de "email ya registrado" (409) se limpia en cuanto el admin
    // vuelve a tocar el campo, para no dejar un mensaje viejo colgado.
    this.form.controls.email.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (!this.form.controls.email.hasError('server')) return;
      const { server, ...rest } = this.form.controls.email.errors ?? {};
      this.form.controls.email.setErrors(Object.keys(rest).length ? rest : null);
      this.emailServerMessage.set(null);
    });
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

    const { email, fullName, role, password } = this.form.getRawValue();

    this.usersService
      .create({ email, full_name: fullName, role, password })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (user) => {
          this.submitting.set(false);
          this.dialogRef.close(user);
        },
        error: (error: unknown) => {
          this.submitting.set(false);
          this.form.enable();

          if (error instanceof HttpErrorResponse && error.status === 409) {
            const detail = typeof error.error?.detail === 'string' ? error.error.detail : EMAIL_TAKEN_MESSAGE;
            this.emailServerMessage.set(detail);
            this.form.controls.email.setErrors({ ...this.form.controls.email.errors, server: true });
            return;
          }

          const result = classifyFormError(error);
          this.errorMessage.set(result.message ?? SUBMIT_ERROR_MESSAGE);
        },
      });
  }

  cancel(): void {
    if (this.submitting()) return;
    this.dialogRef.close(undefined);
  }
}
