import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { map, startWith } from 'rxjs';
import { ConfigService } from './config.service';
import { ConfigStatusService } from './config-status.service';
import { classifyFormError, formSaveErrorMessage } from '../../shared/form-error';
import {
  API_TOKEN_HINTS,
  NO_SAVED_CONNECTION,
  SavedJsmConnection,
  apiTokenRequirement,
  buildJsmConnectionRequest,
  hasApiToken,
  statusAfterSave,
} from './jsm-connection-form';
import { WebhookSecretComponent } from './webhook-secret/webhook-secret.component';

export type JsmConnectionState = 'loading' | 'error' | 'loaded';

// Un campo con solo espacios cuenta como vacio, igual que al enviarlo recortado
function notBlank(control: AbstractControl): ValidationErrors | null {
  return String(control.value ?? '').trim().length > 0 ? null : { required: true };
}

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

  // Lo ultimo que el backend tiene guardado: con eso se decide si el token es
  // obligatorio.
  private readonly saved = signal<SavedJsmConnection>(NO_SAVED_CONNECTION);

  readonly form = new FormGroup({
    baseUrl: new FormControl('', { nonNullable: true, validators: [notBlank] }),
    userEmail: new FormControl('', { nonNullable: true, validators: [notBlank] }),
    apiToken: new FormControl('', { nonNullable: true, validators: [(control) => this.apiTokenValidator(control)] }),
  });

  private readonly formValues = toSignal(
    this.form.valueChanges.pipe(
      startWith(null),
      map(() => this.form.getRawValue()),
    ),
    { requireSync: true },
  );

  readonly tokenRequirement = computed(() => apiTokenRequirement(this.saved(), this.formValues()));
  readonly tokenHint = computed(() => API_TOKEN_HINTS[this.tokenRequirement()]);

  constructor() {
    // El token depende de la URL y del correo: si cambian, se vuelve a validar
    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.form.controls.apiToken.updateValueAndValidity({ emitEvent: false }));

    this.fetchConnection();
  }

  // Obligatorio salvo que haya una conexion guardada y la URL y el correo
  // sigan siendo los mismos. Un token con solo espacios cuenta como ausente.
  private apiTokenValidator(control: AbstractControl): ValidationErrors | null {
    const parent = control.parent;
    if (!parent) return null;

    const requirement = apiTokenRequirement(this.saved(), {
      baseUrl: parent.get('baseUrl')?.value ?? '',
      userEmail: parent.get('userEmail')?.value ?? '',
    });
    return requirement !== 'optional' && !hasApiToken(control.value ?? '') ? { required: true } : null;
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

    const request = buildJsmConnectionRequest(this.form.getRawValue());

    this.configService
      .configureItsmConnection(request)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.configured.set(true);
          // el backend guarda lo recortado que se envio: eso es lo guardado
          this.saved.set({ configured: true, baseUrl: request.base_url, userEmail: request.user_email });
          this.form.enable();
          // el token nunca se vuelve a mostrar, aunque la conexion haya quedado
          // guardada
          this.form.patchValue({ baseUrl: request.base_url, userEmail: request.user_email, apiToken: '' });
          this.form.controls.apiToken.markAsUntouched();
          this.form.controls.apiToken.updateValueAndValidity({ emitEvent: false });
          this.snackBar.open('Conexión guardada', 'Cerrar', { duration: 4000 });
          // el centro de Configuracion y el bloque del secreto reflejan el
          // cambio sin recargar: primero el estado esperado, y despues el que
          // devuelve el backend, que es el que vale
          this.configStatus.setJsmConnected(statusAfterSave(request.base_url, request.user_email));
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
          this.saved.set({
            configured: connection.configured,
            baseUrl: connection.base_url,
            userEmail: connection.user_email,
          });
          this.form.patchValue({
            baseUrl: connection.base_url ?? '',
            userEmail: connection.user_email ?? '',
          });
          this.form.controls.apiToken.updateValueAndValidity({ emitEvent: false });
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
