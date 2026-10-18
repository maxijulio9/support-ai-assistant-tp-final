import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { AuthService } from '../../../core/auth/auth.service';
import { classifyFormError } from '../../../shared/form-error';

const SUBMIT_ERROR_MESSAGE = 'Ocurrió un error inesperado. Intentá de nuevo.';

// Validador cruzado del lado del cliente: el backend solo pide new_password,
// no hay un campo de confirmacion en el contrato. Se re-evalua a mano cada
// vez que newPassword cambia (ver el subscribe en el constructor), porque
// Angular no revalida un control hermano solo porque el otro cambio.
function passwordsMatchValidator(control: AbstractControl): ValidationErrors | null {
  const parent = control.parent;
  if (!parent) return null;
  return control.value === parent.get('newPassword')?.value ? null : { passwordsMismatch: true };
}

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, MatButtonModule, MatCardModule, MatFormFieldModule, MatIconModule, MatInputModule],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPasswordComponent {
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private readonly newPasswordInput = viewChild<ElementRef<HTMLInputElement>>('newPasswordInput');

  // Se lee una sola vez: esta pantalla es de un solo uso, no hace falta
  // reaccionar a cambios de query params despues de montada.
  private readonly token: string | null;
  readonly hasToken: boolean;

  readonly form = new FormGroup({
    newPassword: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(8), Validators.maxLength(72)],
    }),
    confirmPassword: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, passwordsMatchValidator],
    }),
  });

  readonly submitting = signal(false);
  readonly submitted = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly passwordVisible = signal(false);

  constructor() {
    this.token = this.route.snapshot.queryParamMap.get('token');
    this.hasToken = this.token !== null;

    // Saca el token de la barra de direcciones apenas se lee: no debe quedar
    // en el historial del navegador ni copiarse sin querer junto a la URL.
    if (this.hasToken) {
      this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
    }

    // confirmPassword no se revalida solo porque newPassword cambio (son
    // controles hermanos, Angular no los enlaza automaticamente).
    this.form.controls.newPassword.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.form.controls.confirmPassword.updateValueAndValidity({ onlySelf: true }));
  }

  togglePasswordVisibility(): void {
    this.passwordVisible.update((visible) => !visible);
  }

  onSubmit(): void {
    if (this.submitting() || !this.token) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.errorMessage.set(null);
    this.submitting.set(true);

    const { newPassword } = this.form.getRawValue();

    this.authService
      .resetPassword(this.token, newPassword)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.submitted.set(true);
        },
        error: (error: unknown) => {
          this.submitting.set(false);
          const result = classifyFormError(error);
          this.errorMessage.set(result.message ?? SUBMIT_ERROR_MESSAGE);
          this.form.reset();
          this.newPasswordInput()?.nativeElement.focus();
        },
      });
  }
}
