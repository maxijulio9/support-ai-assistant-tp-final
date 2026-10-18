import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../core/auth/auth.service';
import { classifyFormError } from '../../shared/form-error';
import { roleLabel } from '../../shared/role-label';
import { UserResponse } from '../../api/models/user-response';

export type ProfileState = 'loading' | 'error' | 'loaded';

const LOAD_ERROR_MESSAGE = 'Ocurrió un error inesperado. Intentá de nuevo.';
const SUBMIT_ERROR_MESSAGE = 'Ocurrió un error inesperado. Intentá de nuevo.';
const NAME_MAX_LENGTH = 255;

// El contrato no declara un maxLength para full_name en UpdateProfileRequest:
// 255 es un tope razonable propio (tamano tipico de columna de nombre), no
// un valor que venga del backend.

function formatCreatedAt(createdAt: string): string {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('es', { dateStyle: 'long' });
}

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [ReactiveFormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatIconModule, MatInputModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileComponent {
  private readonly authService = inject(AuthService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly state = signal<ProfileState>('loading');
  readonly profile = signal<UserResponse | null>(null);
  readonly loadErrorMessage = signal<string | null>(null);
  readonly submitErrorMessage = signal<string | null>(null);
  readonly submitting = signal(false);

  // Nombre contra el que se compara "no cambio": arranca en el nombre
  // cargado y pasa a ser el ultimo guardado despues de un guardado exitoso.
  private readonly savedName = signal<string | null>(null);

  readonly createdAtLabel = computed(() => {
    const createdAt = this.profile()?.created_at;
    return createdAt ? formatCreatedAt(createdAt) : '';
  });
  readonly roleLabel = computed(() => roleLabel(this.profile()?.role));

  readonly form = new FormGroup({
    fullName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(NAME_MAX_LENGTH)],
    }),
  });

  // form.controls.fullName.value no es una signal: toSignal() la vuelve
  // reactiva para que nameUnchanged se recalcule con cada tecla.
  private readonly fullNameValue = toSignal(this.form.controls.fullName.valueChanges, {
    initialValue: this.form.controls.fullName.value,
  });

  readonly nameUnchanged = computed(() => {
    const current = this.fullNameValue().trim();
    return current === (this.savedName() ?? '').trim();
  });

  constructor() {
    this.fetchProfile();
  }

  retryLoad(): void {
    this.fetchProfile();
  }

  onSubmit(): void {
    if (this.submitting() || this.nameUnchanged() || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitErrorMessage.set(null);
    this.submitting.set(true);

    const fullName = this.form.controls.fullName.value.trim();

    this.authService
      .updateProfile(fullName)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (profile) => {
          this.submitting.set(false);
          this.profile.set(profile);
          this.savedName.set(profile.full_name);
          this.form.controls.fullName.setValue(profile.full_name);
          this.snackBar.open('Perfil actualizado', 'Cerrar', { duration: 4000 });
        },
        error: (error: unknown) => {
          this.submitting.set(false);
          const result = classifyFormError(error);
          this.submitErrorMessage.set(result.message ?? SUBMIT_ERROR_MESSAGE);
        },
      });
  }

  private fetchProfile(): void {
    this.state.set('loading');
    this.loadErrorMessage.set(null);

    this.authService
      .loadProfile()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (profile) => {
          this.profile.set(profile);
          this.savedName.set(profile.full_name);
          this.form.controls.fullName.setValue(profile.full_name);
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
