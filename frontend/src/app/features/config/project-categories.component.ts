import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ConfigService } from './config.service';
import { classifyFormError } from '../../shared/form-error';
import {
  categoriesHaveChanges,
  categoriesOutsideFieldMessage,
  categoriesOutsideOptions,
  categorySaveBlockedReason,
  categorySaveSuccessMessage,
  mergedActiveCategories,
} from './project-categories-form';
import { JsmField } from '../../api/models/jsm-field';

export type ProjectCategoriesState = 'loading' | 'error' | 'loaded';
export type FieldOptionsState = 'idle' | 'loading' | 'error' | 'empty' | 'loaded';

const GENERIC_ERROR_MESSAGE = 'Ocurrió un error inesperado. Intentá de nuevo.';

@Component({
  selector: 'app-project-categories',
  standalone: true,
  imports: [MatButtonModule, MatCheckboxModule, MatFormFieldModule, MatSelectModule],
  templateUrl: './project-categories.component.html',
  styleUrl: './project-categories.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectCategoriesComponent {
  private readonly configService = inject(ConfigService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly projectKey = input.required<string>();

  private readonly fieldsState = signal<ProjectCategoriesState>('loading');
  private readonly detailState = signal<ProjectCategoriesState>('loading');
  readonly loadErrorMessage = signal<string | null>(null);

  readonly state = computed<ProjectCategoriesState>(() => {
    if (this.fieldsState() === 'error' || this.detailState() === 'error') return 'error';
    if (this.fieldsState() === 'loading' || this.detailState() === 'loading') return 'loading';
    return 'loaded';
  });

  readonly fields = signal<JsmField[]>([]);

  // Nombres de categoria activos segun el ultimo guardado o carga: la
  // referencia contra la que se compara para saber si hay cambios sin
  // guardar, y a lo que vuelve el set de trabajo si el guardado falla al
  // refrescar.
  private readonly activeNamesAtLoad = signal<ReadonlySet<string>>(new Set());

  // Set de trabajo: arranca igual a activeNamesAtLoad en cada carga o
  // guardado exitoso, y nunca se reinicia al cambiar de campo (solo al
  // cambiar de proyecto), para no perder un toggle hecho bajo otro campo.
  private readonly pendingActiveNames = signal<ReadonlySet<string>>(new Set());

  readonly selectedFieldId = signal<string | null>(null);
  readonly optionsState = signal<FieldOptionsState>('idle');
  readonly optionsErrorMessage = signal<string | null>(null);
  readonly options = signal<string[]>([]);

  readonly submitting = signal(false);
  readonly submitErrorMessage = signal<string | null>(null);

  // Categorias activas en el set de trabajo que no pertenecen a las
  // opciones del campo elegido: no tienen fila propia, pero se preservan
  // igual al guardar (ver mergedActiveCategories en onSubmit).
  private readonly preservedNames = computed(() =>
    categoriesOutsideOptions(this.pendingActiveNames(), this.options()),
  );
  readonly preservedMessage = computed(() => categoriesOutsideFieldMessage(this.preservedNames().length));

  private readonly hasChanges = computed(() =>
    categoriesHaveChanges(this.pendingActiveNames(), this.activeNamesAtLoad()),
  );

  readonly canSubmit = computed(
    () => this.hasChanges() && this.pendingActiveNames().size > 0 && !this.submitting(),
  );

  // Solo se muestra si el admin ya destildo todo lo que habia activo: un
  // proyecto que todavia no tiene ninguna categoria activa al cargar no
  // muestra este mensaje hasta que haya un cambio real.
  readonly blockedReason = computed(() =>
    this.hasChanges() ? categorySaveBlockedReason(this.pendingActiveNames()) : null,
  );

  constructor() {
    this.fetchFields();

    effect(() => {
      const projectKey = this.projectKey();
      this.fetchDetail(projectKey);
    });
  }

  retryLoad(): void {
    if (this.fieldsState() === 'error') this.fetchFields();
    if (this.detailState() === 'error') this.fetchDetail(this.projectKey());
  }

  isPendingActive(option: string): boolean {
    return this.pendingActiveNames().has(option);
  }

  onSelectField(fieldId: string): void {
    this.selectedFieldId.set(fieldId);
    this.optionsState.set('loading');
    this.optionsErrorMessage.set(null);

    this.configService
      .listFieldOptions(fieldId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (options) => {
          this.options.set(options);
          this.optionsState.set(options.length === 0 ? 'empty' : 'loaded');
        },
        error: (error: unknown) => {
          const result = classifyFormError(error);
          this.optionsErrorMessage.set(result.message ?? GENERIC_ERROR_MESSAGE);
          this.optionsState.set('error');
        },
      });
  }

  retryOptions(): void {
    const fieldId = this.selectedFieldId();
    if (fieldId) this.onSelectField(fieldId);
  }

  toggleOption(option: string, checked: boolean): void {
    this.pendingActiveNames.update((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(option);
      } else {
        next.delete(option);
      }
      return next;
    });
  }

  onSubmit(): void {
    if (!this.canSubmit()) return;

    this.submitting.set(true);
    this.submitErrorMessage.set(null);

    const checkedInCurrentField = this.options().filter((option) => this.pendingActiveNames().has(option));
    const categories = mergedActiveCategories(checkedInCurrentField, this.preservedNames());

    this.configService
      .configureCategories(this.projectKey(), categories)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => this.refreshAfterSave(response.categories_deactivated),
        error: (error: unknown) => {
          this.submitting.set(false);
          const result = classifyFormError(error);
          this.submitErrorMessage.set(result.message ?? GENERIC_ERROR_MESSAGE);
        },
      });
  }

  private refreshAfterSave(categoriesDeactivated: number): void {
    this.configService
      .getProjectConfiguration(this.projectKey())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (detail) => {
          this.submitting.set(false);
          const activeNames = new Set(
            detail.categories.filter((category) => category.is_active).map((category) => category.name),
          );
          this.activeNamesAtLoad.set(activeNames);
          this.pendingActiveNames.set(activeNames);
          this.snackBar.open(categorySaveSuccessMessage(categoriesDeactivated), 'Cerrar', { duration: 4000 });
        },
        error: () => {
          this.submitting.set(false);
          this.snackBar.open('Se guardó, pero no se pudo actualizar la lista. Recargá la sección.', 'Cerrar', {
            duration: 5000,
          });
        },
      });
  }

  private fetchFields(): void {
    this.fieldsState.set('loading');

    this.configService
      .listSelectFields()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (fields) => {
          this.fields.set(fields);
          this.fieldsState.set('loaded');
        },
        error: (error: unknown) => {
          const result = classifyFormError(error);
          this.loadErrorMessage.set(result.message ?? GENERIC_ERROR_MESSAGE);
          this.fieldsState.set('error');
        },
      });
  }

  private fetchDetail(projectKey: string): void {
    this.detailState.set('loading');
    this.selectedFieldId.set(null);
    this.options.set([]);
    this.optionsState.set('idle');

    this.configService
      .getProjectConfiguration(projectKey)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (detail) => {
          const activeNames = new Set(
            detail.categories.filter((category) => category.is_active).map((category) => category.name),
          );
          this.activeNamesAtLoad.set(activeNames);
          this.pendingActiveNames.set(activeNames);
          this.detailState.set('loaded');
        },
        error: (error: unknown) => {
          const result = classifyFormError(error);
          this.loadErrorMessage.set(result.message ?? GENERIC_ERROR_MESSAGE);
          this.detailState.set('error');
        },
      });
  }
}
