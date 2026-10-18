import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../core/auth/auth.service';
import { UsersService } from './users.service';
import { classifyFormError } from '../../shared/form-error';
import { roleLabel } from '../../shared/role-label';
import { UserResponse } from '../../api/models/user-response';
import { CreateUserDialogComponent, CreateUserDialogResult } from './create-user-dialog.component';
import { EditUserDialogComponent, EditUserDialogData, EditUserDialogResult } from './edit-user-dialog.component';
import {
  DeactivateUserDialogComponent,
  DeactivateUserDialogData,
  DeactivateUserDialogResult,
} from './deactivate-user-dialog.component';

export type UsersState = 'loading' | 'error' | 'loaded';

const LOAD_ERROR_MESSAGE = 'Ocurrió un error inesperado. Intentá de nuevo.';

function formatCreatedAt(createdAt: string): string {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('es', { dateStyle: 'long' });
}

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [MatButtonModule, MatTooltipModule],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsersComponent {
  private readonly usersService = inject(UsersService);
  private readonly authService = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly roleLabel = roleLabel;
  readonly formattedCreatedAt = formatCreatedAt;

  readonly state = signal<UsersState>('loading');
  readonly users = signal<UserResponse[]>([]);
  readonly loadErrorMessage = signal<string | null>(null);

  readonly sortedUsers = computed(() =>
    [...this.users()].sort((a, b) => a.full_name.localeCompare(b.full_name, 'es')),
  );

  constructor() {
    this.fetchUsers();
  }

  isSelf(user: UserResponse): boolean {
    return user.id === this.authService.profile()?.id;
  }

  retryLoad(): void {
    this.fetchUsers();
  }

  openCreate(): void {
    const dialogRef = this.dialog.open<CreateUserDialogComponent, never, CreateUserDialogResult>(
      CreateUserDialogComponent,
      { disableClose: true, width: '480px' },
    );

    dialogRef.afterClosed().subscribe((user) => {
      if (!user) return;
      this.users.update((current) => [...current, user]);
      this.snackBar.open('Usuario creado', 'Cerrar', { duration: 4000 });
    });
  }

  openEdit(user: UserResponse): void {
    const dialogRef = this.dialog.open<EditUserDialogComponent, EditUserDialogData, EditUserDialogResult>(
      EditUserDialogComponent,
      { data: { user, isSelf: this.isSelf(user) }, disableClose: true, width: '480px' },
    );

    dialogRef.afterClosed().subscribe((updated) => {
      if (!updated) return;
      this.users.update((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      this.snackBar.open('Usuario actualizado', 'Cerrar', { duration: 4000 });
    });
  }

  openDeactivate(user: UserResponse): void {
    const dialogRef = this.dialog.open<
      DeactivateUserDialogComponent,
      DeactivateUserDialogData,
      DeactivateUserDialogResult
    >(DeactivateUserDialogComponent, { data: { user }, disableClose: true, width: '420px' });

    dialogRef.afterClosed().subscribe((updated) => {
      if (!updated) return;
      this.users.update((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      this.snackBar.open('Usuario desactivado', 'Cerrar', { duration: 4000 });
    });
  }

  private fetchUsers(): void {
    this.state.set('loading');
    this.loadErrorMessage.set(null);

    this.usersService
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (users) => {
          this.users.set(users);
          this.state.set('loaded');
        },
        error: (error: unknown) => {
          const result = classifyFormError(error);
          this.loadErrorMessage.set(result.message ?? LOAD_ERROR_MESSAGE);
          this.state.set('error');
        },
      });
  }
}
