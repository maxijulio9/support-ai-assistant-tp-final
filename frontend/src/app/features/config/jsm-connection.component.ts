import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ConfigService } from './config.service';
import { ConfigStatusService } from './config-status.service';
import { classifyFormError, formSaveErrorMessage } from '../../shared/form-error';
import { buildJsmConnectionRequest, statusAfterSave } from './jsm-connection-form';
import { WebhookSecretComponent } from './webhook-secret/webhook-secret.component';

export type JsmConnectionState = 'loading' | 'error' | 'loaded';

const LOAD_ERROR_MESSAGE = 'Ocurrió un error inesperado. Intentá de nuevo.';
const SUBMIT_ERROR_MESSAGE = 'Ocurrió un error inesperado. Intentá de nuevo.';

@Component({
  selector: 'app-jsm-connection',
  standalone: true,
  imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, WebhookSecretComponent],
  templateUrl: './jsm-connection.component.html',
  styleUrl: './jsm-connection.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JsmConnectionComponent {
  private readonly configService = inject(ConfigService);
  private readonly configStatus = inject(ConfigStatusService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly state = signal<JsmConnectionState>('loading');
  readonly loadErrorMessage = signal<string | null>(null);
  readonly configured = signal(false);
  readonly submitting = signal(false);
  readonly submitErrorMessage = signal<string | null>(null);

  readonly form = new FormGroup({
    baseUrl: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    userEmail: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    apiToken: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  constructor() {
    this.fetchConnection();
  }

  retryLoad(): void {
    this.fetchConnection();
  }

  onSubmit(): void {
    if (this.submitting()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitErrorMessage.set(null);
    this.submitting.set(true);
    this.form.disable();

    const { baseUrl, userEmail, apiToken } = this.form.getRawValue();

    this.configService
      .configureItsmConnection(buildJsmConnectionRequest({ baseUrl, userEmail, apiToken }))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.form.enable();
          this.configured.set(true);
          // el token nunca se vuelve a mostrar, aunque la conexion haya quedado
          // guardada
          this.form.patchValue({ apiToken: '' });
          this.snackBar.open('Conexión guardada', 'Cerrar', { duration: 4000 });
          // el centro de Configuracion y el bloque del secreto reflejan el
          // cambio sin recargar: primero el estado esperado, y despues el que
          // devuelve el backend, que es el que vale
          this.configStatus.setJsmConnected(statusAfterSave(baseUrl, userEmail));
          this.configStatus.refresh('jsm');
        },
        error: (error: unknown) => {
          this.submitting.set(false);
          this.form.enable();
          this.submitErrorMessage.set(formSaveErrorMessage(error, SUBMIT_ERROR_MESSAGE));
        },
      });
  }

  private fetchConnection(): void {
    this.state.set('loading');
    this.loadErrorMessage.set(null);

    this.configService
      .getItsmConnection()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (connection) => {
          this.configured.set(connection.configured);
          this.form.patchValue({
            baseUrl: connection.base_url ?? '',
            userEmail: connection.user_email ?? '',
          });
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
