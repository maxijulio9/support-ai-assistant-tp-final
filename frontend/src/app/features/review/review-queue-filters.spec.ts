import { InteractionListItem } from '../../api/models/interaction-list-item';
import {
  EMPTY_QUEUE_FILTERS,
  filterQueue,
  priorityOptions,
  priorityRank,
  projectKey,
  projectOptions,
  sortQueue,
} from './review-queue-filters';

function item(id: string, issueKey: string, priority: string | null, createdAt: string | null, summary = 'Asunto'): InteractionListItem {
  return {
    interaction_id: id,
    issue_key: issueKey,
    priority,
    created_at: createdAt,
    summary,
    category: null,
    confidence_score: null,
    decision: null,
    resolution_channel: null,
    system_decision: null,
    ticket_url: null,
    was_edited: false,
    responded_at: null,
  };
}

const ITEMS = [
  item('a', 'ABC-1', 'Low', '2026-01-01T10:00:00Z', 'Error de red'),
  item('b', 'ABC-2', 'Highest', '2026-01-03T10:00:00Z'),
  item('c', 'XYZ-3', 'Highest', '2026-01-02T10:00:00Z'),
  item('d', 'XYZ-4', null, '2026-01-04T10:00:00Z'),
  item('e', 'ABC-5', 'Urgente', null),
  item('f', 'ABC-6', 'medium', '2026-01-05T10:00:00Z'),
];

const ids = (list: InteractionListItem[]) => list.map((entry) => entry.interaction_id);

describe('priorityRank', () => {
  it('sigue la escala y no distingue mayusculas', () => {
    expect(priorityRank('Highest')).toBe(0);
    expect(priorityRank('medium')).toBe(2);
    expect(priorityRank('Lowest')).toBe(4);
  });

  it('fuera de la escala o vacia: null', () => {
    expect(priorityRank('Urgente')).toBeNull();
    expect(priorityRank('')).toBeNull();
    expect(priorityRank(null)).toBeNull();
  });
});

describe('projectKey', () => {
  it('toma lo anterior al guion', () => {
    expect(projectKey('ABC-123')).toBe('ABC');
  });

  it('sin guion devuelve la clave entera', () => {
    expect(projectKey('SOLO')).toBe('SOLO');
  });
});

describe('sortQueue', () => {
  it('mas recientes primero, sin fecha al final', () => {
    expect(ids(sortQueue(ITEMS, 'newest'))).toEqual(['f', 'd', 'b', 'c', 'a', 'e']);
  });

  it('mas antiguas primero, sin fecha al final', () => {
    expect(ids(sortQueue(ITEMS, 'oldest'))).toEqual(['a', 'c', 'b', 'd', 'f', 'e']);
  });

  it('prioridad mayor a menor: desempata por fecha reciente y deja lo desconocido al final', () => {
    expect(ids(sortQueue(ITEMS, 'priority-desc'))).toEqual(['b', 'c', 'f', 'a', 'd', 'e']);
  });

  it('prioridad menor a mayor: lo desconocido sigue al final', () => {
    expect(ids(sortQueue(ITEMS, 'priority-asc'))).toEqual(['a', 'f', 'b', 'c', 'd', 'e']);
  });

  it('no muta la lista original', () => {
    const before = ids(ITEMS);
    sortQueue(ITEMS, 'oldest');
    expect(ids(ITEMS)).toEqual(before);
  });
});

describe('filterQueue', () => {
  it('sin filtros devuelve todo', () => {
    expect(filterQueue(ITEMS, EMPTY_QUEUE_FILTERS)).toHaveLength(6);
  });

  it('busca en asunto y clave', () => {
    expect(ids(filterQueue(ITEMS, { ...EMPTY_QUEUE_FILTERS, term: ' red ' }))).toEqual(['a']);
    expect(ids(filterQueue(ITEMS, { ...EMPTY_QUEUE_FILTERS, term: 'xyz-4' }))).toEqual(['d']);
  });

  it('combina prioridad y proyecto', () => {
    expect(ids(filterQueue(ITEMS, { term: '', priority: 'Highest', project: 'XYZ' }))).toEqual(['c']);
  });
});

describe('priorityOptions', () => {
  it('siempre trae las 5 de la escala, con cantidad 0 donde no hay', () => {
    const options = priorityOptions(ITEMS, EMPTY_QUEUE_FILTERS);
    expect(options.map((option) => option.value)).toEqual(['Highest', 'High', 'Medium', 'Low', 'Lowest']);
    expect(options.map((option) => option.count)).toEqual([2, 0, 1, 1, 0]);
  });

  it('cuenta segun el proyecto activo pero ignora la prioridad elegida', () => {
    const options = priorityOptions(ITEMS, { term: '', priority: 'Low', project: 'XYZ' });
    expect(options.map((option) => option.count)).toEqual([1, 0, 0, 0, 0]);
  });
});

describe('projectOptions', () => {
  it('deriva los proyectos de las claves, ordenados, con su cantidad', () => {
    expect(projectOptions(ITEMS, EMPTY_QUEUE_FILTERS)).toEqual([
      { value: 'ABC', count: 4 },
      { value: 'XYZ', count: 2 },
    ]);
  });

  it('un proyecto sin coincidencias con los otros filtros queda en 0 pero presente', () => {
    expect(projectOptions(ITEMS, { term: '', priority: 'Low', project: null })).toEqual([
      { value: 'ABC', count: 1 },
      { value: 'XYZ', count: 0 },
    ]);
  });
});
