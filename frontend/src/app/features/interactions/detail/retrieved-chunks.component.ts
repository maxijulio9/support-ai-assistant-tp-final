import { ChangeDetectionStrategy, Component, computed, effect, input, signal, untracked } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { InteractionSource } from '../../../api/models/interaction-source';
import { RetrievedChunkDetail } from '../../../api/models/retrieved-chunk-detail';
import { InteractionSourcesComponent } from '../interaction-sources.component';
import { FRAGMENT_UNAVAILABLE, NEW_TAB_HINT, fragmentToggleContext, fragmentToggleLabel } from '../interaction-sources';
import { CHUNKS_NOTE, CHUNKS_TITLE, buildRetrievedRows } from '../retrieved-chunks';

// Fragmentos que trajo la busqueda semantica, con su similitud, y el texto y
// el enlace de la pagina cuando hay fuente. Sin fragmentos guardados (por
// ejemplo una interaccion vieja) muestra solo las fuentes, como antes.
@Component({
  selector: 'app-retrieved-chunks',
  standalone: true,
  imports: [MatIconModule, InteractionSourcesComponent],
  templateUrl: './retrieved-chunks.component.html',
  styleUrl: './retrieved-chunks.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RetrievedChunksComponent {
  readonly chunks = input.required<RetrievedChunkDetail[]>();
  readonly sources = input.required<InteractionSource[]>();

  readonly title = CHUNKS_TITLE;
  readonly note = CHUNKS_NOTE;
  readonly unavailableText = FRAGMENT_UNAVAILABLE;
  readonly newTabHint = NEW_TAB_HINT;
  readonly toggleLabel = fragmentToggleLabel;
  readonly toggleContext = fragmentToggleContext;

  private readonly expandedKeys = signal<ReadonlySet<string>>(new Set());

  readonly rows = computed(() => buildRetrievedRows(this.chunks(), this.sources()));

  constructor() {
    // Al cambiar de solicitud, ningun fragmento queda expandido
    effect(() => {
      this.chunks();
      untracked(() => this.expandedKeys.set(new Set()));
    });
  }

  isExpanded(key: string): boolean {
    return this.expandedKeys().has(key);
  }

  toggle(key: string): void {
    this.expandedKeys.update((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  }
}
