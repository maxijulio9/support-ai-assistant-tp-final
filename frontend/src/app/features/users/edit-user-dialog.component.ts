import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { AuthService } from '../../core/auth/auth.service';
import { SessionService } from '../../core/auth/session.service';
import { UsersService } from './users.service';
import { classifyFormError } from '../../shared/form-error';
import { roleLabel } from '../../shared/role-label';
import { UserResponse } from '../../api/models/user-response';

export interface EditUserDialogData {
  user: UserResponse;
  isSelf: boolean;
}

export type EditUserDialogResult = UserResponse | undefined;

const SUBMIT_ERROR_MESSAGE = 'Ocurrió un error inesperado. Intentá de nuevo.';
const NAME_MAX_LENGTH = 255;

@Component({
  selector: 'app-edit-user-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './edit-user-dialog.component.html',
  styleUrl: './edit-user-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditUserDialogComponent {
  private readonly usersService = inject(UsersService);
  private readonly authService = inject(AuthService);
  private readonly sessionService = inject(SessionService);
  private readonly data = inject<EditUserDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<EditUserDialogComponent, EditUserDialogResult>);
  private readonly destroyRef = inject(DestroyRef);

  readonly roleLabel = roleLabel;
  readonly roleOptions: ReadonlyArray<'admin' | 'agent'> = ['agent', 'admin'];
  readonly isSelf = this.data.isSelf;
  readonly email = this.data.user.email;

  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = new FormGroup({
    fullName: new FormControl(this.data.user.full_name, {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(NAME_MAX_LENGTH)],
    }),
    role: new FormControl<'admin' | 'agent'>(this.data.user.role as 'admin' | 'agent', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  onSubmit(): void {
    if (this.submitting()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.errorMessage.set(null);
    this.submitting.set(true);
    this.form.disable();

    // Se captura antes del PUT (no despues): es la misma guarda que usa
    // AuthService.updateProfile, para no pisar el perfil de una sesion mas
    // nueva si cambia mientras la request esta en vuelo.
    const tokenAtRequestTime = this.sessionService.token();
    const { fullName, role } = this.form.getRawValue();

    this.usersService
      .update(this.data.user.id, { full_name: fullName, role })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (user) => {
          this.submitting.set(false);
          if (this.isSelf) {
            this.authService.syncOwnProfileName(user.id, user.full_name, tokenAtRequestTime);
          }
          this.dialogRef.close(user);
        },
        error: (error: unknown) => {
          this.submitting.set(false);
          this.form.enable();
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
