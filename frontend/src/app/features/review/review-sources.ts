import { SOURCES_TITLE } from '../interactions/interaction-sources';

// Texto del boton que pliega la lista: el titulo fijo mas la cantidad.
export function sourcesToggleTitle(count: number): string {
  return `${SOURCES_TITLE} (${count})`;
}

// La lista vacia no se pliega: no hay nada que ocultar.
export function isSourcesFoldable(count: number): boolean {
  return count > 0;
}
