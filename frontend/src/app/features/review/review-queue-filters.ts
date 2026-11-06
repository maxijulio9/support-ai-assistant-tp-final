import { InteractionListItem } from '../../api/models/interaction-list-item';

export type QueueSort = 'newest' | 'oldest' | 'priority-desc' | 'priority-asc';

export const DEFAULT_QUEUE_SORT: QueueSort = 'newest';

export const QUEUE_SORT_OPTIONS: { value: QueueSort; label: string }[] = [
  { value: 'newest', label: 'Más recientes primero' },
  { value: 'oldest', label: 'Más antiguas primero' },
  { value: 'priority-desc', label: 'Prioridad: mayor a menor' },
  { value: 'priority-asc', label: 'Prioridad: menor a mayor' },
];

// Escala de prioridad de la instancia de JSM, de mayor a menor. Cualquier
// otro valor (o vacio) queda fuera de la escala y va al final al ordenar.
export const PRIORITY_SCALE = ['Highest', 'High', 'Medium', 'Low', 'Lowest'] as const;

export interface QueueFilters {
  term: string;
  priority: string | null;
  project: string | null;
}

export const EMPTY_QUEUE_FILTERS: QueueFilters = { term: '', priority: null, project: null };

export interface CountedOption {
  value: string;
  count: number;
}

// Posicion en la escala (0 = la mayor); sin escala devuelve null.
export function priorityRank(priority: string | null | undefined): number | null {
  const normalized = priority?.trim().toLowerCase();
  if (!normalized) return null;
  const index = PRIORITY_SCALE.findIndex((level) => level.toLowerCase() === normalized);
  return index === -1 ? null : index;
}

// Proyecto de una solicitud: la parte de la clave antes del guion.
export function projectKey(issueKey: string): string {
  const index = issueKey.indexOf('-');
  return index > 0 ? issueKey.slice(0, index) : issueKey;
}

function createdTime(item: InteractionListItem): number | null {
  if (!item.created_at) return null;
  const time = new Date(item.created_at).getTime();
  return Number.isNaN(time) ? null : time;
}

// Fecha mas reciente primero; sin fecha valida al final.
function compareNewestFirst(a: InteractionListItem, b: InteractionListItem): number {
  const timeA = createdTime(a);
  const timeB = createdTime(b);
  if (timeA === timeB) return 0;
  if (timeA === null) return 1;
  if (timeB === null) return -1;
  return timeB - timeA;
}

function compareOldestFirst(a: InteractionListItem, b: InteractionListItem): number {
  const timeA = createdTime(a);
  const timeB = createdTime(b);
  if (timeA === timeB) return 0;
  if (timeA === null) return 1;
  if (timeB === null) return -1;
  return timeA - timeB;
}

// Ordena sin mutar. Por prioridad, lo que no esta en la escala va siempre al
// final (en ambos sentidos) y el desempate es la fecha mas reciente primero.
export function sortQueue(items: readonly InteractionListItem[], sort: QueueSort): InteractionListItem[] {
  const copy = [...items];
  switch (sort) {
    case 'oldest':
      return copy.sort(compareOldestFirst);
    case 'priority-desc':
    case 'priority-asc': {
      const direction = sort === 'priority-desc' ? 1 : -1;
      return copy.sort((a, b) => {
        const rankA = priorityRank(a.priority);
        const rankB = priorityRank(b.priority);
        if (rankA === null && rankB === null) return compareNewestFirst(a, b);
        if (rankA === null) return 1;
        if (rankB === null) return -1;
        return (rankA - rankB) * direction || compareNewestFirst(a, b);
      });
    }
    default:
      return copy.sort(compareNewestFirst);
  }
}

function matchesTerm(item: InteractionListItem, term: string): boolean {
  const normalized = term.trim().toLowerCase();
  if (!normalized) return true;
  return (item.summary ?? '').toLowerCase().includes(normalized) || item.issue_key.toLowerCase().includes(normalized);
}

function matchesPriority(item: InteractionListItem, priority: string | null): boolean {
  return !priority || priorityRank(item.priority) === priorityRank(priority);
}

function matchesProject(item: InteractionListItem, project: string | null): boolean {
  return !project || projectKey(item.issue_key) === project;
}

export function filterQueue(items: readonly InteractionListItem[], filters: QueueFilters): InteractionListItem[] {
  return items.filter(
    (item) =>
      matchesTerm(item, filters.term) && matchesPriority(item, filters.priority) && matchesProject(item, filters.project),
  );
}

// Cantidad por nivel de la escala (las 5 siempre presentes), segun lo que
// dejan pasar la busqueda y el proyecto. El propio filtro de prioridad no se
// aplica: asi cada opcion dice cuantas habria si se la eligiera.
export function priorityOptions(items: readonly InteractionListItem[], filters: QueueFilters): CountedOption[] {
  const base = filterQueue(items, { ...filters, priority: null });
  return PRIORITY_SCALE.map((level) => ({
    value: level,
    count: base.filter((item) => priorityRank(item.priority) === priorityRank(level)).length,
  }));
}

// Proyectos presentes en la cola, ordenados por clave, con su cantidad segun
// la busqueda y la prioridad activas.
export function projectOptions(items: readonly InteractionListItem[], filters: QueueFilters): CountedOption[] {
  const base = filterQueue(items, { ...filters, project: null });
  const keys = new Set(items.map((item) => projectKey(item.issue_key)));
  return [...keys]
    .sort((a, b) => a.localeCompare(b))
    .map((value) => ({ value, count: base.filter((item) => projectKey(item.issue_key) === value).length }));
}
