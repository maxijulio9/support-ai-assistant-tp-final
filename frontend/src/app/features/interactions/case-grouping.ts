import { InteractionListItem } from '../../api/models/interaction-list-item';

// Agrupado del Historial por ticket. Cada fila del API es una interaccion y un
// mismo ticket puede tener varias, cada una con su decision y categoria. Son
// funciones puras para poder fijar con specs el orden, los filtros y el caso
// que el limite de la lista puede cortar.
export interface InteractionFilters {
  term: string;
  status: string | null;
  category: string | null;
}

export const MIXED_CATEGORIES_LABEL = 'Varias';

export function filterInteractions(
  items: readonly InteractionListItem[],
  filters: InteractionFilters,
): InteractionListItem[] {
  const term = filters.term.trim().toLowerCase();
  return items.filter((item) => {
    const matchesTerm =
      !term || item.issue_key.toLowerCase().includes(term) || (item.summary ?? '').toLowerCase().includes(term);
    const matchesStatus = !filters.status || item.decision === filters.status;
    const matchesCategory = !filters.category || item.category === filters.category;
    return matchesTerm && matchesStatus && matchesCategory;
  });
}

export interface CaseGroup {
  issueKey: string;
  // Interacciones que cumplen los filtros, la mas reciente primero
  interactions: InteractionListItem[];
  // La mas reciente de las que se muestran: de ella salen el resumen, el estado y la prioridad
  latest: InteractionListItem;
  // Cuantas interacciones tiene el caso entre las cargadas, con o sin filtros
  loadedCount: number;
  // La categoria si es una sola, o "Varias" si cambio entre interacciones
  categoryLabel: string;
  // El limite de la lista pudo cortar este caso: puede tener interacciones anteriores sin cargar
  possiblyIncomplete: boolean;
}

function timeOf(item: InteractionListItem): number | null {
  if (!item.created_at) return null;
  const time = new Date(item.created_at).getTime();
  return Number.isNaN(time) ? null : time;
}

// Mas reciente primero, sin fecha al final. El orden es estable: con la misma
// fecha (o sin ninguna) se respeta el de la lista.
function newestFirst(a: InteractionListItem, b: InteractionListItem): number {
  const timeA = timeOf(a);
  const timeB = timeOf(b);
  if (timeA === timeB) return 0;
  if (timeA === null) return 1;
  if (timeB === null) return -1;
  return timeB - timeA;
}

function categoryLabelOf(interactions: readonly InteractionListItem[]): string {
  const categories = new Set(interactions.map((item) => item.category).filter((category): category is string => !!category));
  if (categories.size === 0) return '';
  if (categories.size === 1) return Array.from(categories)[0];
  return MIXED_CATEGORIES_LABEL;
}

// Tickets cuyas interacciones mas antiguas son las mas antiguas de todo lo
// cargado. Solo si la lista llego al limite: con menos filas se cargo todo.
// La lista viene de la mas nueva a la mas vieja, asi que lo que el limite
// corto es lo anterior a esa fila. Sin ninguna fecha se usa la ultima fila.
export function possiblyIncompleteKeys(all: readonly InteractionListItem[], limit: number): Set<string> {
  if (all.length === 0 || all.length < limit) return new Set();

  const times = all.map(timeOf).filter((time): time is number => time !== null);
  if (times.length === 0) return new Set([all[all.length - 1].issue_key]);

  const oldest = Math.min(...times);
  return new Set(all.filter((item) => timeOf(item) === oldest).map((item) => item.issue_key));
}

// all: todo lo cargado. filtered: lo que cumple los filtros, que decide que
// casos se muestran y con que interacciones.
export function buildCases(
  all: readonly InteractionListItem[],
  filtered: readonly InteractionListItem[],
  limit: number,
): CaseGroup[] {
  const loadedCounts = new Map<string, number>();
  for (const item of all) loadedCounts.set(item.issue_key, (loadedCounts.get(item.issue_key) ?? 0) + 1);

  const byKey = new Map<string, InteractionListItem[]>();
  for (const item of filtered) {
    const group = byKey.get(item.issue_key);
    if (group) group.push(item);
    else byKey.set(item.issue_key, [item]);
  }

  const incomplete = possiblyIncompleteKeys(all, limit);

  return Array.from(byKey.entries())
    .map(([issueKey, group]): CaseGroup => {
      const interactions = group.slice().sort(newestFirst);
      return {
        issueKey,
        interactions,
        latest: interactions[0],
        loadedCount: loadedCounts.get(issueKey) ?? interactions.length,
        categoryLabel: categoryLabelOf(interactions),
        possiblyIncomplete: incomplete.has(issueKey),
      };
    })
    .sort((a, b) => newestFirst(a.latest, b.latest));
}

export function isSingleInteraction(group: CaseGroup): boolean {
  return group.loadedCount === 1;
}

// "3 interacciones", o "2 de 3 interacciones" cuando un filtro deja afuera alguna
export function interactionsCountText(group: CaseGroup): string {
  const shown = group.interactions.length;
  const total = group.loadedCount;
  const word = total === 1 ? 'interacción' : 'interacciones';
  return shown < total ? `${shown} de ${total} ${word}` : `${total} ${word}`;
}

export const POSSIBLY_INCOMPLETE_LABEL = 'Posiblemente incompleto';
export function possiblyIncompleteDetail(limit: number): string {
  return `Es la interacción más antigua de las ${limit} cargadas. Este ticket puede tener interacciones anteriores que no se muestran.`;
}

export function confidencePercentText(score: number | null): string {
  if (score === null || score === undefined || Number.isNaN(score)) return '';
  return `${Math.min(100, Math.max(0, Math.round(score * 100)))}%`;
}
