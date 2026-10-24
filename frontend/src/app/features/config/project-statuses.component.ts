import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { FormControl, FormRecord, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subscription, forkJoin } from 'rxjs';
import { ConfigService } from './config.service';
import {
  StatusMappingRow,
  StatusMappingValidation,
  buildStatusMappingRows,
  buildStatusMappingsPayload,
  canSaveStatusMappings,
  statusMappingsHaveChanges,
  validateStatusMappings,
} from './project-statuses-form';
import { classifyFormError } from '../../shared/form-error';
import { JsmStatus } from '../../api/models/jsm-status';
import { StatusActionItem } from '../../api/models/status-action-item';

export type ProjectStatusesState = 'loading' | 'error' | 'loaded';

const LOAD_ERROR_MESSAGE = 'Ocurrió un error inesperado. Intentá de nuevo.';
const SAVE_ERROR_MESSAGE =
  'No se pudo guardar el mapeo de estados. No se guardó ningún cambio, ni del mapeo ni de los umbrales. Intentá de nuevo.';
const RELOAD_ERROR_MESSAGE = 'El mapeo se guardó, pero no se pudo recargar la pantalla. Intentá de nuevo.';
const NO_ACTION_HINT = 'El estado no dispara ninguna acción.';

// mat-select no selecciona una opcion cuyo valor es null, por eso "Sin accion"
// vive en el control como cadena vacia y se traduce a null al validar y enviar.
const NO_ACTION_VALUE = '';

@Component({
  selector: 'app-project-statuses',
  standalone: true,
  imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatSelectModule],
  templateUrl: './project-statuses.component.html',
  styleUrl: './project-statuses.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectStatusesComponent {
  private readonly configService = inject(ConfigService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly snackBar = inject(MatSnackBar);

  readonly projectKey = input.required<string>();

  readonly noActionValue = NO_ACTION_VALUE;
  readonly state = signal<ProjectStatusesState>('loading');
  readonly loadErrorMessage = signal<string | null>(null);
  readonly actions = signal<StatusActionItem[]>([]);
  readonly rows = signal<StatusMappingRow[]>([]);
  // Mismas filas que rows pero con lo que hay elegido ahora en cada selector
  readonly currentRows = signal<StatusMappingRow[]>([]);
  readonly validation = signal<StatusMappingValidation>({ rowErrors: {}, warnings: [] });
  readonly saving = signal(false);
  readonly submitErrorMessage = signal<string | null>(null);

  readonly canSave = computed(() => !this.saving() && canSaveStatusMappings(this.currentRows(), this.validation()));
  readonly canDiscard = computed(() => !this.saving() && statusMappingsHaveChanges(this.currentRows()));

  private statuses: JsmStatus[] = [];
  private form = new FormRecord<FormControl<string>>({});
  private loadSubscription: Subscription | null = null;
  private valuesSubscription: Subscription | null = null;

  constructor() {
    // GET .../statuses escribe en ticket_status como efecto secundario: se
    // llama una sola vez por cada proyecto elegido, nunca en cada render.
    effect(() => {
      const projectKey = this.projectKey();
      this.fetchAll(projectKey);
    });

    this.destroyRef.onDestroy(() => {
      this.loadSubscription?.unsubscribe();
      this.valuesSubscription?.unsubscribe();
    });
  }

  retryLoad(): void {
    this.fetchAll(this.projectKey());
  }

  controlFor(statusId: string): FormControl<string> {
    return this.form.controls[statusId];
  }

  hintFor(statusId: string): string {
    const current = this.currentRows().find((row) => row.statusId === statusId);
    if (!current || current.action === null) return NO_ACTION_HINT;
    return this.actions().find((action) => action.value === current.action)?.description ?? '';
  }

  onDiscard(): void {
    if (!this.canDiscard()) return;
    this.submitErrorMessage.set(null);
    this.form.reset(this.initialValues(this.rows()));
  }

  // Una sola transaccion en el backend: si falla, no se guardo nada y las
  // ediciones del admin siguen en pantalla para reintentar.
  onSave(): void {
    if (!this.canSave()) return;

    const projectKey = this.projectKey();
    this.saving.set(true);
    this.submitErrorMessage.set(null);
    this.form.disable({ emitEvent: false });

    this.configService
      .saveProjectStatusMappings(projectKey, buildStatusMappingsPayload(this.currentRows()))
      .subscribe({
        next: () => {
          this.snackBar.open('Mapeo de estados guardado', 'Cerrar', { duration: 4000 });
          // Si se cambio de proyecto mientras guardaba, la pantalla ya es
          // de otro proyecto y no hay nada que rearmar.
          if (projectKey !== this.projectKey()) return;
          this.reloadSaved(projectKey);
        },
        error: (error: unknown) => {
          if (projectKey !== this.projectKey()) return;
          const result = classifyFormError(error);
          const detail = result.category === 'validation-message' ? result.message : null;
          this.submitErrorMessage.set(detail ?? SAVE_ERROR_MESSAGE);
          this.saving.set(false);
          this.form.enable({ emitEvent: false });
        },
      });
  }

  // Las tres cargas van juntas y el editor solo se arma si llegan las tres:
  // sin las acciones o sin el detalle no hay forma de mostrar el mapeo
  // actual, asi que no se degrada a una lectura parcial. Si se cambia de
  // proyecto en medio de una carga, la respuesta anterior se descarta.
  private fetchAll(projectKey: string): void {
    this.loadSubscription?.unsubscribe();
    this.valuesSubscription?.unsubscribe();
    this.state.set('loading');
    this.loadErrorMessage.set(null);
    this.submitErrorMessage.set(null);
    this.saving.set(false);

    this.loadSubscription = forkJoin({
      statuses: this.configService.listProjectStatuses(projectKey),
      actions: this.configService.listStatusActions(),
      detail: this.configService.getProjectConfiguration(projectKey),
    }).subscribe({
      next: ({ statuses, actions, detail }) => {
        const rows = buildStatusMappingRows(statuses, detail.status_mappings);
        this.statuses = statuses;
        this.actions.set(actions);
        this.rows.set(rows);
        this.buildForm(rows);
        this.state.set('loaded');
      },
      error: (error: unknown) => {
        const result = classifyFormError(error);
        this.loadErrorMessage.set(result.message ?? LOAD_ERROR_MESSAGE);
        this.state.set('error');
      },
    });
  }

  // Solo se vuelve a pedir el detalle: los estados de JSM no cambiaron y su
  // endpoint tiene efecto secundario, asi que se reusan los ya cargados.
  private reloadSaved(projectKey: string): void {
    this.loadSubscription?.unsubscribe();
    this.loadSubscription = this.configService.getProjectConfiguration(projectKey).subscribe({
      next: (detail) => {
        const rows = buildStatusMappingRows(this.statuses, detail.status_mappings);
        this.rows.set(rows);
        this.buildForm(rows);
        this.saving.set(false);
      },
      error: () => {
        this.loadErrorMessage.set(RELOAD_ERROR_MESSAGE);
        this.saving.set(false);
        this.state.set('error');
      },
    });
  }

  private initialValues(rows: StatusMappingRow[]): Record<string, string> {
    return Object.fromEntries(rows.map((row) => [row.statusId, row.savedAction ?? NO_ACTION_VALUE]));
  }

  private buildForm(rows: StatusMappingRow[]): void {
    this.valuesSubscription?.unsubscribe();
    this.form = new FormRecord<FormControl<string>>(
      Object.fromEntries(
        rows.map((row) => [row.statusId, new FormControl(row.action ?? NO_ACTION_VALUE, { nonNullable: true })]),
      ),
    );
    this.valuesSubscription = this.form.valueChanges.subscribe(() => this.refreshValidation());
    this.refreshValidation();
  }

  // mat-error solo aparece con el control en error y tocado: el error de
  // cada fila se carga a mano en su control y se marca como tocado, asi un
  // valor guardado invalido o un conflicto con otra fila se ve de entrada.
  private refreshValidation(): void {
    const rows = this.rows().map((row) => ({
      ...row,
      action: this.form.controls[row.statusId].value === NO_ACTION_VALUE ? null : this.form.controls[row.statusId].value,
    }));
    const validation = validateStatusMappings(rows, this.actions());

    this.currentRows.set(rows);
    this.validation.set(validation);

    for (const row of rows) {
      const control = this.form.controls[row.statusId];
      const message = validation.rowErrors[row.statusId];
      if (message) {
        control.setErrors({ mapping: message });
        control.markAsTouched();
      } else if (control.hasError('mapping')) {
        control.setErrors(null);
      }
    }
  }
}
