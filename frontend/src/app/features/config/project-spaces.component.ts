import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { forkJoin } from 'rxjs';
import { ConfigService } from './config.service';
import { classifyFormError } from '../../shared/form-error';
import { ConfluenceSpaceItem } from '../../api/models/confluence-space-item';
import { ProjectSpaceItem } from '../../api/models/project-space-item';
import { Country } from '../../api/models/country';

export type ProjectSpacesState = 'loading' | 'error' | 'loaded';

const GENERIC_ERROR_MESSAGE = 'Ocurrió un error inesperado. Intentá de nuevo.';
const PERSONAL_SPACE_PREFIX = '~';

function isPersonalSpace(key: string): boolean {
  return key.startsWith(PERSONAL_SPACE_PREFIX);
}

@Component({
  selector: 'app-project-spaces',
  standalone: true,
  imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  templateUrl: './project-spaces.component.html',
  styleUrl: './project-spaces.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectSpacesComponent {
  private readonly configService = inject(ConfigService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly projectKey = input.required<string>();

  private readonly catalogsState = signal<ProjectSpacesState>('loading');
  private readonly detailState = signal<ProjectSpacesState>('loading');
  readonly loadErrorMessage = signal<string | null>(null);

  readonly state = computed<ProjectSpacesState>(() => {
    if (this.catalogsState() === 'error' || this.detailState() === 'error') return 'error';
    if (this.catalogsState() === 'loading' || this.detailState() === 'loading') return 'loading';
    return 'loaded';
  });

  readonly availableSpaces = signal<ConfluenceSpaceItem[]>([]);
  readonly countries = signal<Country[]>([]);
  readonly linkedSpaces = signal<ProjectSpaceItem[]>([]);

  private readonly linkedSpaceKeys = computed(() => new Set(this.linkedSpaces().map((space) => space.space_key)));

  readonly hasEligible = computed(() =>
    this.availableSpaces().some((space) => !this.linkedSpaceKeys().has(space.key)),
  );

  readonly selectedSpaceKey = signal<string | null>(null);
  readonly submitting = signal(false);
  readonly submitErrorMessage = signal<string | null>(null);

  readonly form = new FormGroup({
    description: new FormControl('', { nonNullable: true }),
    languageCode: new FormControl('', { nonNullable: true }),
    countryCode: new FormControl<string | null>(null),
  });

  readonly canSubmit = computed(() => !!this.selectedSpaceKey() && !this.submitting());

  constructor() {
    this.fetchCatalogs();

    effect(() => {
      const projectKey = this.projectKey();
      this.fetchDetail(projectKey);
    });
  }

  retryLoad(): void {
    if (this.catalogsState() === 'error') this.fetchCatalogs();
    if (this.detailState() === 'error') this.fetchDetail(this.projectKey());
  }

  isPersonal(key: string): boolean {
    return isPersonalSpace(key);
  }

  isLinked(key: string): boolean {
    return this.linkedSpaceKeys().has(key);
  }

  nameFor(spaceKey: string): string | null {
    return this.availableSpaces().find((space) => space.key === spaceKey)?.name ?? null;
  }

  selectSpace(spaceKey: string): void {
    this.selectedSpaceKey.set(spaceKey);
  }

  onAdd(): void {
    const spaceKey = this.selectedSpaceKey();
    if (!this.canSubmit() || !spaceKey) return;

    this.submitting.set(true);
    this.submitErrorMessage.set(null);

    const { description, languageCode, countryCode } = this.form.getRawValue();

    this.configService
      .addProjectSpace(this.projectKey(), {
        space_key: spaceKey,
        description: description.trim() || null,
        language_code: languageCode.trim() || null,
        country_code: countryCode,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.refreshAfterAdd(),
        error: (error: unknown) => {
          this.submitting.set(false);
          const result = classifyFormError(error);
          this.submitErrorMessage.set(result.message ?? GENERIC_ERROR_MESSAGE);
        },
      });
  }

  private refreshAfterAdd(): void {
    forkJoin({
      available: this.configService.listAvailableSpaces(),
      detail: this.configService.getProjectConfiguration(this.projectKey()),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ available, detail }) => {
          this.submitting.set(false);
          this.availableSpaces.set(available);
          this.linkedSpaces.set(detail.spaces);
          this.resetPickForm(detail.project.country_code);
          this.snackBar.open('Espacio vinculado', 'Cerrar', { duration: 4000 });
        },
        error: () => {
          this.submitting.set(false);
          this.selectedSpaceKey.set(null);
          this.snackBar.open('Se vinculó, pero no se pudo actualizar la lista. Recargá la sección.', 'Cerrar', {
            duration: 5000,
          });
        },
      });
  }

  private resetPickForm(projectCountryCode: string | null): void {
    this.selectedSpaceKey.set(null);
    this.form.setValue({ description: '', languageCode: '', countryCode: projectCountryCode });
  }

  private fetchCatalogs(): void {
    this.catalogsState.set('loading');

    forkJoin({
      spaces: this.configService.listAvailableSpaces(),
      countries: this.configService.listCountries(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ spaces, countries }) => {
          this.availableSpaces.set(spaces);
          this.countries.set(countries);
          this.catalogsState.set('loaded');
        },
        error: (error: unknown) => {
          const result = classifyFormError(error);
          this.loadErrorMessage.set(result.message ?? GENERIC_ERROR_MESSAGE);
          this.catalogsState.set('error');
        },
      });
  }

  private fetchDetail(projectKey: string): void {
    this.detailState.set('loading');

    this.configService
      .getProjectConfiguration(projectKey)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (detail) => {
          this.linkedSpaces.set(detail.spaces);
          this.resetPickForm(detail.project.country_code);
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
