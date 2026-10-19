import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ConfigService } from './config.service';
import { classifyFormError } from '../../shared/form-error';
import { JsmField } from '../../api/models/jsm-field';

export type ProjectCategoriesState = 'loading' | 'error' | 'loaded';
export type FieldOptionsState = 'idle' | 'loading' | 'error' | 'empty' | 'loaded';

const GENERIC_ERROR_MESSAGE = 'Ocurrió un error inesperado. Intentá de nuevo.';

@Component({
  selector: 'app-project-categories',
  standalone: true,
  imports: [MatButtonModule, MatCheckboxModule, MatFormFieldModule, MatIconModule, MatSelectModule],
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

  // Nombres de categoria ya vinculados y activos para este proyecto: por la
  // limitacion conocida del backend (solo agrega, no hay API para desactivar
  // ni quitar), estos quedan bloqueados en el checklist, no se destildan.
  private readonly savedCategoryNames = signal<ReadonlySet<string>>(new Set());

  readonly selectedFieldId = signal<string | null>(null);
  readonly optionsState = signal<FieldOptionsState>('idle');
  readonly optionsErrorMessage = signal<string | null>(null);
  readonly options = signal<string[]>([]);
  private readonly newlySelected = signal<ReadonlySet<string>>(new Set());

  readonly submitting = signal(false);
  readonly submitErrorMessage = signal<string | null>(null);

  readonly canSubmit = computed(() => this.newlySelected().size > 0 && !this.submitting());

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

  isLocked(option: string): boolean {
    return this.savedCategoryNames().has(option);
  }

  isNewlySelected(option: string): boolean {
    return this.newlySelected().has(option);
  }

  onSelectField(fieldId: string): void {
    this.selectedFieldId.set(fieldId);
    this.newlySelected.set(new Set());
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
    if (this.isLocked(option)) return;

    this.newlySelected.update((current) => {
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

    // Union de lo ya guardado mas lo nuevo elegido: hoy es inocuo reenviar
    // lo ya guardado (el backend solo agrega y lo ya vinculado no se
    // reactiva ni se duplica), y el dia que el backend trate la lista como
    // el conjunto activo completo, esto ya queda correcto sin tocar la pantalla.
    const categories = [...new Set([...this.savedCategoryNames(), ...this.newlySelected()])];

    this.configService
      .configureCategories(this.projectKey(), categories)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.refreshAfterSave(),
        error: (error: unknown) => {
          this.submitting.set(false);
          const result = classifyFormError(error);
          this.submitErrorMessage.set(result.message ?? GENERIC_ERROR_MESSAGE);
        },
      });
  }

  private refreshAfterSave(): void {
    this.configService
      .getProjectConfiguration(this.projectKey())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (detail) => {
          this.submitting.set(false);
          this.savedCategoryNames.set(
            new Set(detail.categories.filter((category) => category.is_active).map((category) => category.name)),
          );
          this.newlySelected.set(new Set());
          this.snackBar.open('Categorías guardadas', 'Cerrar', { duration: 4000 });
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
    this.newlySelected.set(new Set());

    this.configService
      .getProjectConfiguration(projectKey)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (detail) => {
          this.savedCategoryNames.set(
            new Set(detail.categories.filter((category) => category.is_active).map((category) => category.name)),
          );
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
