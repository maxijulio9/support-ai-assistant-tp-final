import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { ConfigService } from './config.service';
import { classifyFormError } from '../../shared/form-error';
import {
  indexedSpaceCountryLabel,
  indexedSpaceDescriptionLabel,
  indexedSpaceLanguageLabel,
  indexedSpaceLastUpdatedLabel,
} from './indexed-spaces-display';
import {
  IndexingRunLike,
  indexingStatusLabel,
  indexingStatusTone,
  justFinishedIndexing,
  truncatedErrorDetail,
} from './indexing-status-display';
import { IndexedSpace } from '../../api/models/indexed-space';

export type IndexedSpacesState = 'loading' | 'error' | 'empty' | 'loaded';

const GENERIC_ERROR_MESSAGE = 'Ocurrió un error inesperado. Intentá de nuevo.';

// Pantalla de solo lectura: todos los espacios del sistema, sin relacion
// con el proyecto elegido en "Iniciar indexacion" ni con el picker de
// "Espacios a indexar". Se recarga al abrir la pantalla y, en silencio,
// cada vez que la corrida que muestra "Ultima indexacion" recien termina
// (ver lastRunStatus y justFinishedIndexing). Sin polling propio.
@Component({
  selector: 'app-indexed-spaces',
  standalone: true,
  imports: [MatButtonModule],
  templateUrl: './indexed-spaces.component.html',
  styleUrl: './indexed-spaces.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IndexedSpacesComponent {
  private readonly configService = inject(ConfigService);
  private readonly destroyRef = inject(DestroyRef);

  // Lo completa el padre con el status() de IndexingStatusComponent.
  readonly lastRunStatus = input<IndexingRunLike | null>(null);

  readonly state = signal<IndexedSpacesState>('loading');
  readonly loadErrorMessage = signal<string | null>(null);
  readonly spaces = signal<IndexedSpace[]>([]);

  private readonly expandedKeys = signal<ReadonlySet<string>>(new Set());

  private previousRunStatus: string | null = null;

  readonly countryLabel = indexedSpaceCountryLabel;
  readonly languageLabel = indexedSpaceLanguageLabel;
  readonly descriptionLabel = indexedSpaceDescriptionLabel;
  readonly lastUpdatedLabel = indexedSpaceLastUpdatedLabel;
  readonly runLabel = indexingStatusLabel;
  readonly runTone = indexingStatusTone;
  readonly truncateError = truncatedErrorDetail;

  constructor() {
    this.fetchSpaces(false);

    effect(() => {
      const currentStatus = this.lastRunStatus()?.status ?? null;
      if (justFinishedIndexing(this.previousRunStatus, currentStatus)) {
        this.fetchSpaces(true);
      }
      this.previousRunStatus = currentStatus;
    });
  }

  retry(): void {
    this.fetchSpaces(false);
  }

  isExpanded(spaceKey: string): boolean {
    return this.expandedKeys().has(spaceKey);
  }

  toggleExpanded(spaceKey: string): void {
    this.expandedKeys.update((current) => {
      const next = new Set(current);
      if (next.has(spaceKey)) {
        next.delete(spaceKey);
      } else {
        next.add(spaceKey);
      }
      return next;
    });
  }

  // Silencioso en la recarga post indexacion: no debe tapar la lista ya
  // mostrada con un esqueleto por un refresco que corre solo.
  private fetchSpaces(silent: boolean): void {
    if (!silent) {
      this.state.set('loading');
      this.loadErrorMessage.set(null);
    }

    this.configService
      .listIndexedSpaces()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (spaces) => {
          this.spaces.set(spaces);
          this.state.set(spaces.length === 0 ? 'empty' : 'loaded');
        },
        error: (error: unknown) => {
          // un fallo pasajero durante la recarga silenciosa no debe tapar
          // la lista que ya se esta mostrando; el proximo intento la repite.
          if (silent) return;
          this.spaces.set([]);
          const result = classifyFormError(error);
          this.loadErrorMessage.set(result.message ?? GENERIC_ERROR_MESSAGE);
          this.state.set('error');
        },
      });
  }
}
