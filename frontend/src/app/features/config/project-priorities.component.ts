import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ConfigService, PriorityMapping } from './config.service';
import { classifyFormError } from '../../shared/form-error';
import { JsmPriority } from '../../api/models/jsm-priority';

export type ProjectPrioritiesState = 'loading' | 'error' | 'loaded';

const GENERIC_ERROR_MESSAGE = 'Ocurrió un error inesperado. Intentá de nuevo.';

// Orden de lectura habitual de los niveles universales; los que no entran
// en esta lista (si el backend llegara a mandar algo distinto) se agregan
// al final, nunca se descartan.
const CANONICAL_LEVEL_ORDER = ['Highest', 'High', 'Medium', 'Low'];

function sortLevels(levels: Iterable<string>): string[] {
  const set = new Set(levels);
  const known = CANONICAL_LEVEL_ORDER.filter((level) => set.has(level));
  const extra = [...set].filter((level) => !CANONICAL_LEVEL_ORDER.includes(level));
  return [...known, ...extra];
}

@Component({
  selector: 'app-project-priorities',
  standalone: true,
  imports: [MatButtonModule, MatFormFieldModule, MatIconModule, MatSelectModule],
  templateUrl: './project-priorities.component.html',
  styleUrl: './project-priorities.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectPrioritiesComponent {
  private readonly configService = inject(ConfigService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly projectKey = input.required<string>();

  private readonly prioritiesState = signal<ProjectPrioritiesState>('loading');
  private readonly mappingState = signal<ProjectPrioritiesState>('loading');
  readonly loadErrorMessage = signal<string | null>(null);

  readonly state = computed<ProjectPrioritiesState>(() => {
    if (this.prioritiesState() === 'error' || this.mappingState() === 'error') return 'error';
    if (this.prioritiesState() === 'loading' || this.mappingState() === 'loading') return 'loading';
    return 'loaded';
  });

  readonly priorities = signal<JsmPriority[]>([]);
  private readonly suggestions = signal<Record<string, string | null>>({});

  // Nivel universal -> ids reales ya guardados para ese nivel. Por la
  // limitacion conocida del backend (solo agrega, no quita ni mueve ids),
  // cualquier id que aparezca aca queda bloqueado en esa fila.
  private readonly savedMapping = signal<PriorityMapping>({});

  // Seleccion en curso para las prioridades SIN nivel guardado. null = sin elegir todavia.
  private readonly newAssignments = signal<Record<string, string | null>>({});

  readonly submitting = signal(false);
  readonly submitErrorMessage = signal<string | null>(null);

  readonly levels = computed(() => sortLevels([...Object.keys(this.suggestions()), ...Object.keys(this.savedMapping())]));

  readonly canSubmit = computed(
    () => !this.submitting() && Object.values(this.newAssignments()).some((level) => level !== null),
  );

  readonly unassignedNames = computed(() => {
    const assignments = this.newAssignments();
    return this.priorities()
      .filter((priority) => this.lockedLevelFor(priority.id) === null && !assignments[priority.id])
      .map((priority) => priority.name);
  });

  constructor() {
    effect(() => {
      const projectKey = this.projectKey();
      this.fetchAll(projectKey);
    });
  }

  retryLoad(): void {
    this.fetchAll(this.projectKey());
  }

  lockedLevelFor(priorityId: string): string | null {
    const mapping = this.savedMapping();
    for (const level of Object.keys(mapping)) {
      if (mapping[level].includes(priorityId)) return level;
    }
    return null;
  }

  assignmentFor(priorityId: string): string | null {
    return this.newAssignments()[priorityId] ?? null;
  }

  setAssignment(priorityId: string, level: string): void {
    this.newAssignments.update((current) => ({ ...current, [priorityId]: level }));
  }

  onSubmit(): void {
    if (!this.canSubmit()) return;

    this.submitting.set(true);
    this.submitErrorMessage.set(null);

    // Union de lo ya guardado mas lo nuevo elegido, sin claves vacias: hoy
    // el backend solo agrega, asi que reenviar lo ya guardado es inocuo.
    const mapping: PriorityMapping = {};
    for (const [level, ids] of Object.entries(this.savedMapping())) {
      mapping[level] = [...ids];
    }
    for (const [priorityId, level] of Object.entries(this.newAssignments())) {
      if (!level) continue;
      mapping[level] = [...(mapping[level] ?? []), priorityId];
    }
    for (const level of Object.keys(mapping)) {
      if (mapping[level].length === 0) delete mapping[level];
    }

    this.configService
      .configurePriorityMapping(this.projectKey(), mapping)
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
          this.applyMapping(detail.priority_mapping);
          this.snackBar.open('Prioridades guardadas', 'Cerrar', { duration: 4000 });
        },
        error: () => {
          this.submitting.set(false);
          this.snackBar.open('Se guardó, pero no se pudo actualizar la lista. Recargá la sección.', 'Cerrar', {
            duration: 5000,
          });
        },
      });
  }

  private fetchAll(projectKey: string): void {
    this.prioritiesState.set('loading');
    this.mappingState.set('loading');

    this.configService
      .listProjectPriorities(projectKey)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.priorities.set(response.priorities);
          this.suggestions.set(response.suggestions);
          this.prioritiesState.set('loaded');
          this.applySuggestionsToUnassigned();
        },
        error: (error: unknown) => {
          const result = classifyFormError(error);
          this.loadErrorMessage.set(result.message ?? GENERIC_ERROR_MESSAGE);
          this.prioritiesState.set('error');
        },
      });

    this.configService
      .getProjectConfiguration(projectKey)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (detail) => {
          this.applyMapping(detail.priority_mapping);
          this.mappingState.set('loaded');
        },
        error: (error: unknown) => {
          const result = classifyFormError(error);
          this.loadErrorMessage.set(result.message ?? GENERIC_ERROR_MESSAGE);
          this.mappingState.set('error');
        },
      });
  }

  private applyMapping(mapping: PriorityMapping): void {
    this.savedMapping.set(mapping);
    this.newAssignments.set({});
    this.applySuggestionsToUnassigned();
  }

  // Precarga la sugerencia solo para las prioridades sin nivel guardado;
  // las bloqueadas no necesitan seleccion, ya muestran su nivel fijo.
  private applySuggestionsToUnassigned(): void {
    const suggestions = this.suggestions();
    const suggestedLevelByPriorityId: Record<string, string> = {};
    for (const [level, priorityId] of Object.entries(suggestions)) {
      if (priorityId) suggestedLevelByPriorityId[priorityId] = level;
    }

    const assignments: Record<string, string | null> = {};
    for (const priority of this.priorities()) {
      if (this.lockedLevelFor(priority.id) !== null) continue;
      assignments[priority.id] = suggestedLevelByPriorityId[priority.id] ?? null;
    }
    this.newAssignments.set(assignments);
  }
}
