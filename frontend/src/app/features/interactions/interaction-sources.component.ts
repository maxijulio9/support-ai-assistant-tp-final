import { ChangeDetectionStrategy, Component, computed, effect, input, signal, untracked } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { InteractionSource } from '../../api/models/interaction-source';
import {
  FRAGMENT_UNAVAILABLE,
  NEW_TAB_HINT,
  SOURCES_EMPTY,
  SOURCES_NOTE,
  SOURCES_TITLE,
  fragmentToggleContext,
  fragmentToggleLabel,
  hasFragment,
  isFragmentCollapsible,
  sourceLinkUrl,
  sourceSpaceLabel,
  sourceTrackKey,
} from './interaction-sources';

let nextInstanceId = 0;

// Fuentes de la base de conocimiento consultadas para una solicitud. Solo
// muestra lo que recibe: no pide datos. El enlace y el fragmento son datos
// del backend, siempre se pintan con interpolación.
@Component({
  selector: 'app-interaction-sources',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './interaction-sources.component.html',
  styleUrl: './interaction-sources.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InteractionSourcesComponent {
  readonly sources = input.required<InteractionSource[]>();

  private readonly instanceId = nextInstanceId++;
  readonly titleId = `sources-${this.instanceId}-title`;
  private readonly expandedKeys = signal<ReadonlySet<string>>(new Set());

  readonly title = SOURCES_TITLE;
  readonly note = SOURCES_NOTE;
  readonly emptyText = SOURCES_EMPTY;
  readonly unavailableText = FRAGMENT_UNAVAILABLE;
  readonly newTabHint = NEW_TAB_HINT;
  readonly toggleLabel = fragmentToggleLabel;
  readonly toggleContext = fragmentToggleContext;

  readonly rows = computed(() =>
    this.sources().map((source, index) => {
      const key = sourceTrackKey(source.page_title, index);
      return {
        key,
        fragmentId: `sources-${this.instanceId}-fragment-${index}`,
        title: source.page_title,
        href: sourceLinkUrl(source.url),
        space: sourceSpaceLabel(source.space_key),
        fragment: hasFragment(source.fragment) ? source.fragment : null,
        collapsible: isFragmentCollapsible(source.fragment),
      };
    }),
  );

  constructor() {
    // Al cambiar de solicitud, ningún fragmento queda expandido
    effect(() => {
      this.sources();
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
