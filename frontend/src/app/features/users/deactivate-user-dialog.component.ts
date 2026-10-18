import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { UsersService } from './users.service';
import { classifyFormError } from '../../shared/form-error';
import { UserResponse } from '../../api/models/user-response';

export interface DeactivateUserDialogData {
  user: UserResponse;
}

export type DeactivateUserDialogResult = UserResponse | undefined;

const SUBMIT_ERROR_MESSAGE = 'Ocurrió un error inesperado. Intentá de nuevo.';

@Component({
  selector: 'app-deactivate-user-dialog',
  standalone: true,
  imports: [MatButtonModule, MatDialogModule],
  templateUrl: './deactivate-user-dialog.component.html',
  styleUrl: './deactivate-user-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeactivateUserDialogComponent {
  private readonly usersService = inject(UsersService);
  private readonly destroyRef = inject(DestroyRef);

  readonly data = inject<DeactivateUserDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<DeactivateUserDialogComponent, DeactivateUserDialogResult>);

  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  confirm(): void {
    if (this.submitting()) return;

    this.errorMessage.set(null);
    this.submitting.set(true);

    this.usersService
      .deactivate(this.data.user.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (user) => {
          this.submitting.set(false);
          this.dialogRef.close(user);
        },
        error: (error: unknown) => {
          this.submitting.set(false);
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
