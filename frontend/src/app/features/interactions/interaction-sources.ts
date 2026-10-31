import { safeTicketUrl } from '../../shared/safe-ticket-url';

export const SOURCES_TITLE = 'Fuentes consultadas';
export const SOURCES_NOTE = 'Páginas de la base de conocimiento que el sistema consultó para generar la respuesta.';
export const SOURCES_EMPTY =
  'No se consultó la base de conocimiento para esta solicitud o no hay fuentes guardadas.';
export const FRAGMENT_UNAVAILABLE = 'Fragmento no disponible';
export const NEW_TAB_HINT = '(se abre en una pestaña nueva)';

// Con más caracteres que este umbral el fragmento se muestra recortado a unas
// pocas líneas y aparece "Ver más". Es una heurística sobre el texto: el recorte
// real lo hace el CSS según el ancho disponible.
export const FRAGMENT_COLLAPSE_THRESHOLD = 220;

// El enlace viene del backend: solo se usa si es https y no trae usuario ni
// contraseña embebidos (https://usuario:clave@host). Si no, la fuente se
// muestra sin enlace.
export function sourceLinkUrl(url: string | null | undefined): string | null {
  const safe = safeTicketUrl(url);
  if (safe === null) return null;
  const parsed = new URL(safe);
  return parsed.username === '' && parsed.password === '' ? safe : null;
}

export function sourceSpaceLabel(spaceKey: string | null | undefined): string | null {
  const key = spaceKey?.trim();
  return key ? `Espacio ${key}` : null;
}

// El fragmento es texto plano. Uno vacío o en blanco se trata como ausente.
export function hasFragment(fragment: string | null | undefined): fragment is string {
  return typeof fragment === 'string' && fragment.trim().length > 0;
}

export function isFragmentCollapsible(fragment: string | null | undefined): boolean {
  return hasFragment(fragment) && fragment.trim().length > FRAGMENT_COLLAPSE_THRESHOLD;
}

export function fragmentToggleLabel(expanded: boolean): string {
  return expanded ? 'Ver menos' : 'Ver más';
}

// Texto solo para lector de pantalla: distingue un "Ver más" de otro.
export function fragmentToggleContext(pageTitle: string): string {
  return ` sobre ${pageTitle}`;
}

// Las páginas pueden repetir título: el índice evita claves duplicadas.
export function sourceTrackKey(pageTitle: string, index: number): string {
  return `${index}:${pageTitle}`;
}
