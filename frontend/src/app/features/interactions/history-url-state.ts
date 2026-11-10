import { DEFAULT_PAGE_SIZE, parsePageSize } from './history-pagination';
import { HistoryRange, resolveHistoryRange } from './history-range';

// Estado de la pantalla Historial que vive en la URL (busqueda, filtros,
// rango de fechas, pagina y casos abiertos), para que Atras, recargar o pegar el enlace lo
// restauren. Lectura y escritura son funciones puras: un valor invalido se
// ignora sin error y un valor vacio no deja parametros sueltos.
export interface HistoryViewState {
  term: string;
  status: string | null;
  category: string | null;
  // Rango de dias que se pide al servidor; null si no hay
  range: HistoryRange | null;
  page: number;
  pageSize: number;
  // Claves de los tickets expandidos, en el orden en que se abrieron
  expanded: string[];
}

export const EMPTY_HISTORY_VIEW: HistoryViewState = { term: '', status: null, category: null, range: null, page: 1, pageSize: DEFAULT_PAGE_SIZE, expanded: [] };

export const HISTORY_PARAMS = {
  term: 'q',
  status: 'estado',
  category: 'categoria',
  rangeFrom: 'desde',
  rangeTo: 'hasta',
  page: 'pagina',
  pageSize: 'tamano',
  expanded: 'abiertos',
} as const;

interface ParamSource {
  get(name: string): string | null;
}

const EXPANDED_SEPARATOR = ',';
// Tope de casos abiertos que se leen de la URL, para que un enlace armado a mano no la infle
const MAX_EXPANDED = 50;

function parsePage(raw: string | null): number {
  if (raw === null || !/^\d+$/.test(raw)) return 1;
  const page = Number(raw);
  return Number.isSafeInteger(page) && page >= 1 ? page : 1;
}

function parseExpanded(raw: string | null): string[] {
  if (!raw) return [];
  const keys = raw
    .split(EXPANDED_SEPARATOR)
    .map((key) => key.trim())
    .filter((key) => key !== '');
  return Array.from(new Set(keys)).slice(0, MAX_EXPANDED);
}

// validStatuses: los estados que existen. Una categoria desconocida no se
// puede juzgar aca, porque sale de los datos cargados: ver sanitizeCategory.
export function parseHistoryParams(
  params: ParamSource,
  validStatuses: readonly string[],
  today: Date = new Date(),
): HistoryViewState {
  const status = params.get(HISTORY_PARAMS.status);
  const category = params.get(HISTORY_PARAMS.category)?.trim();

  return {
    term: params.get(HISTORY_PARAMS.term)?.trim() ?? '',
    status: status !== null && validStatuses.includes(status) ? status : null,
    category: category ? category : null,
    // Los dos extremos tienen que ser validos y coherentes: si no, se ignora el rango entero
    range: resolveHistoryRange(params.get(HISTORY_PARAMS.rangeFrom), params.get(HISTORY_PARAMS.rangeTo), today),
    page: parsePage(params.get(HISTORY_PARAMS.page)),
    pageSize: parsePageSize(params.get(HISTORY_PARAMS.pageSize)),
    expanded: parseExpanded(params.get(HISTORY_PARAMS.expanded)),
  };
}

// null en un parametro significa "sin parametro": el router lo saca de la URL
export function serializeHistoryParams(state: HistoryViewState): Record<string, string | null> {
  const term = state.term.trim();
  return {
    [HISTORY_PARAMS.term]: term === '' ? null : term,
    [HISTORY_PARAMS.status]: state.status ? state.status : null,
    [HISTORY_PARAMS.category]: state.category ? state.category : null,
    [HISTORY_PARAMS.rangeFrom]: state.range ? state.range.from : null,
    [HISTORY_PARAMS.rangeTo]: state.range ? state.range.to : null,
    [HISTORY_PARAMS.page]: state.page > 1 ? String(state.page) : null,
    // El tamano por defecto no ensucia la URL
    [HISTORY_PARAMS.pageSize]: parsePageSize(state.pageSize) === DEFAULT_PAGE_SIZE ? null : String(parsePageSize(state.pageSize)),
    [HISTORY_PARAMS.expanded]: state.expanded.length > 0 ? state.expanded.join(EXPANDED_SEPARATOR) : null,
  };
}

// Una categoria que no esta entre las de los datos cargados se ignora
export function sanitizeCategory(category: string | null, availableCategories: readonly string[]): string | null {
  return category !== null && availableCategories.includes(category) ? category : null;
}

export function toggleExpanded(expanded: readonly string[], issueKey: string): string[] {
  return expanded.includes(issueKey) ? expanded.filter((key) => key !== issueKey) : [...expanded, issueKey];
}
