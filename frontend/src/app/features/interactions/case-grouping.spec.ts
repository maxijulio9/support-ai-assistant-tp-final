import {
  buildCases,
  confidencePercentText,
  filterInteractions,
  interactionsCountText,
  isSingleInteraction,
  possiblyIncompleteKeys,
} from './case-grouping';
import { InteractionListItem } from '../../api/models/interaction-list-item';

let counter = 0;
function row(issueKey: string, createdAt: string | null, overrides: Partial<InteractionListItem> = {}): InteractionListItem {
  counter += 1;
  return {
    interaction_id: `id-${counter}`,
    issue_key: issueKey,
    summary: `Asunto de ${issueKey}`,
    category: 'Acceso',
    priority: 'High',
    decision: 'AUTO_PUBLISH',
    system_decision: 'AUTO_PUBLISH',
    resolution_channel: null,
    confidence_score: 0.8,
    ticket_url: null,
    was_edited: false,
    created_at: createdAt,
    ...overrides,
  };
}

const NO_FILTERS = { term: '', status: null, category: null };

describe('filterInteractions', () => {
  const items = [
    row('A-1', '2026-11-03T10:00:00Z', { decision: 'ESCALATE', category: 'Red' }),
    row('A-1', '2026-11-02T10:00:00Z', { decision: 'NEEDS_REVIEW', category: 'Acceso' }),
    row('B-2', '2026-11-01T10:00:00Z', { summary: 'No anda la VPN' }),
  ];

  it('sin filtros devuelve todo', () => {
    expect(filterInteractions(items, NO_FILTERS)).toHaveLength(3);
  });

  it('busca por clave o por asunto sin distinguir mayusculas', () => {
    expect(filterInteractions(items, { ...NO_FILTERS, term: ' a-1 ' })).toHaveLength(2);
    expect(filterInteractions(items, { ...NO_FILTERS, term: 'vpn' })).toHaveLength(1);
  });

  it('filtra por estado y por categoria, y los combina', () => {
    expect(filterInteractions(items, { ...NO_FILTERS, status: 'ESCALATE' })).toHaveLength(1);
    expect(filterInteractions(items, { ...NO_FILTERS, category: 'Acceso' })).toHaveLength(2);
    expect(filterInteractions(items, { term: '', status: 'ESCALATE', category: 'Acceso' })).toHaveLength(0);
  });
});

describe('buildCases', () => {
  it('una fila por ticket, con sus interacciones de la mas reciente a la mas antigua', () => {
    const items = [
      row('A-1', '2026-11-01T10:00:00Z'),
      row('B-2', '2026-11-05T10:00:00Z'),
      row('A-1', '2026-11-03T10:00:00Z'),
      row('A-1', '2026-11-02T10:00:00Z'),
    ];

    const cases = buildCases(items, items, 200);
    const a = cases.find((group) => group.issueKey === 'A-1')!;

    expect(cases.map((group) => group.issueKey)).toEqual(['B-2', 'A-1']);
    expect(a.interactions.map((item) => item.created_at)).toEqual([
      '2026-11-03T10:00:00Z',
      '2026-11-02T10:00:00Z',
      '2026-11-01T10:00:00Z',
    ]);
    expect(a.latest).toBe(a.interactions[0]);
  });

  it('ordena los casos por su actividad mas reciente y deja los sin fecha al final', () => {
    const items = [row('SIN-FECHA', null), row('VIEJO', '2026-10-01T00:00:00Z'), row('NUEVO', '2026-11-01T00:00:00Z')];

    expect(buildCases(items, items, 200).map((group) => group.issueKey)).toEqual(['NUEVO', 'VIEJO', 'SIN-FECHA']);
  });

  it('las interacciones sin fecha van al final del caso y se conserva el orden de la lista', () => {
    const first = row('A-1', null);
    const second = row('A-1', null);
    const dated = row('A-1', '2026-11-01T00:00:00Z');

    const [group] = buildCases([first, second, dated], [first, second, dated], 200);

    expect(group.interactions).toEqual([dated, first, second]);
  });

  it('un caso de una sola interaccion es plano', () => {
    const items = [row('A-1', '2026-11-01T00:00:00Z'), row('B-2', '2026-11-02T00:00:00Z'), row('B-2', '2026-11-03T00:00:00Z')];
    const cases = buildCases(items, items, 200);

    expect(isSingleInteraction(cases.find((group) => group.issueKey === 'A-1')!)).toBe(true);
    expect(isSingleInteraction(cases.find((group) => group.issueKey === 'B-2')!)).toBe(false);
  });

  it('la categoria es una sola, o "Varias" si cambio entre interacciones', () => {
    const items = [
      row('A-1', '2026-11-02T00:00:00Z', { category: 'Red' }),
      row('A-1', '2026-11-01T00:00:00Z', { category: 'Red' }),
      row('B-2', '2026-11-02T00:00:00Z', { category: 'Red' }),
      row('B-2', '2026-11-01T00:00:00Z', { category: 'Acceso' }),
      row('C-3', '2026-11-01T00:00:00Z', { category: null }),
    ];
    const label = (key: string) => buildCases(items, items, 200).find((group) => group.issueKey === key)!.categoryLabel;

    expect(label('A-1')).toBe('Red');
    expect(label('B-2')).toBe('Varias');
    expect(label('C-3')).toBe('');
  });

  it('no modifica las listas que recibe', () => {
    const items = [row('A-1', '2026-11-01T00:00:00Z'), row('A-1', '2026-11-03T00:00:00Z')];
    const copy = items.slice();
    buildCases(items, items, 200);

    expect(items).toEqual(copy);
  });

  it('recorrer los casos devuelve cada interaccion una sola vez', () => {
    const items = Array.from({ length: 30 }, (_, index) => row(`K-${index % 7}`, `2026-11-${String(index + 1).padStart(2, '0')}T00:00:00Z`));
    const ids = buildCases(items, items, 200).flatMap((group) => group.interactions.map((item) => item.interaction_id));

    expect(ids.sort()).toEqual(items.map((item) => item.interaction_id).sort());
  });
});

describe('filtros sobre un caso con varias interacciones', () => {
  const items = [
    row('A-1', '2026-11-03T10:00:00Z', { decision: 'ESCALATE' }),
    row('A-1', '2026-11-02T10:00:00Z', { decision: 'NEEDS_REVIEW' }),
    row('A-1', '2026-11-01T10:00:00Z', { decision: 'NEEDS_REVIEW' }),
    row('B-2', '2026-11-04T10:00:00Z', { decision: 'AUTO_PUBLISH' }),
  ];

  it('el caso aparece si alguna interaccion cumple y muestra solo las que cumplen', () => {
    const filtered = filterInteractions(items, { ...NO_FILTERS, status: 'NEEDS_REVIEW' });
    const cases = buildCases(items, filtered, 200);

    expect(cases.map((group) => group.issueKey)).toEqual(['A-1']);
    expect(cases[0].interactions).toHaveLength(2);
    expect(cases[0].loadedCount).toBe(3);
    expect(interactionsCountText(cases[0])).toBe('2 de 3 interacciones');
  });

  it('la fila toma el estado de la mas reciente de las que se muestran', () => {
    const filtered = filterInteractions(items, { ...NO_FILTERS, status: 'NEEDS_REVIEW' });

    expect(buildCases(items, filtered, 200)[0].latest.decision).toBe('NEEDS_REVIEW');
  });

  it('un caso sin ninguna interaccion que cumpla no aparece', () => {
    const filtered = filterInteractions(items, { ...NO_FILTERS, status: 'DISCARDED' });

    expect(buildCases(items, filtered, 200)).toEqual([]);
  });

  it('sin filtros el texto no usa "de"', () => {
    const [group] = buildCases(items, items, 200).filter((candidate) => candidate.issueKey === 'A-1');

    expect(interactionsCountText(group)).toBe('3 interacciones');
  });

  it('con una sola interaccion el texto va en singular', () => {
    const [group] = buildCases(items, items, 200).filter((candidate) => candidate.issueKey === 'B-2');

    expect(interactionsCountText(group)).toBe('1 interacción');
  });

  it('la categoria "Varias" se calcula sobre lo que se muestra', () => {
    const mixed = [
      row('A-1', '2026-11-02T00:00:00Z', { category: 'Red' }),
      row('A-1', '2026-11-01T00:00:00Z', { category: 'Acceso' }),
    ];
    const filtered = filterInteractions(mixed, { ...NO_FILTERS, category: 'Red' });

    expect(buildCases(mixed, filtered, 200)[0].categoryLabel).toBe('Red');
  });
});

describe('posiblemente incompleto', () => {
  const day = (n: number) => `2026-10-${String(n).padStart(2, '0')}T10:00:00Z`;

  it('con menos filas que el limite no hay ninguno', () => {
    const items = [row('A-1', day(3)), row('A-1', day(1))];

    expect(possiblyIncompleteKeys(items, 200).size).toBe(0);
    expect(buildCases(items, items, 200).every((group) => !group.possiblyIncomplete)).toBe(true);
  });

  it('con exactamente el limite marca el ticket de la interaccion mas antigua cargada', () => {
    const items = [row('NUEVO', day(5)), row('MEDIO', day(4)), row('CORTADO', day(2)), row('NUEVO', day(3))];
    const cases = buildCases(items, items, 4);

    expect(cases.filter((group) => group.possiblyIncomplete).map((group) => group.issueKey)).toEqual(['CORTADO']);
  });

  it('si el ticket mas antiguo tiene mas interacciones, es el unico marcado', () => {
    const items = [row('A-1', day(9)), row('B-2', day(8)), row('A-1', day(7)), row('B-2', day(6))];

    expect([...possiblyIncompleteKeys(items, 4)]).toEqual(['B-2']);
  });

  it('con fechas repetidas en la mas antigua marca todos los tickets que la tienen', () => {
    const items = [row('A-1', day(9)), row('B-2', day(1)), row('C-3', day(1))];

    expect([...possiblyIncompleteKeys(items, 3)].sort()).toEqual(['B-2', 'C-3']);
  });

  it('no depende del orden en que llegan las filas', () => {
    const items = [row('CORTADO', day(1)), row('A-1', day(5)), row('B-2', day(4))];

    expect([...possiblyIncompleteKeys(items, 3)]).toEqual(['CORTADO']);
  });

  it('sin ninguna fecha usa la ultima fila', () => {
    const items = [row('A-1', null), row('B-2', null)];

    expect([...possiblyIncompleteKeys(items, 2)]).toEqual(['B-2']);
  });

  it('la marca sale de todo lo cargado, no de lo filtrado', () => {
    const items = [row('A-1', day(5), { decision: 'ESCALATE' }), row('CORTADO', day(1), { decision: 'AUTO_PUBLISH' })];
    const filtered = filterInteractions(items, { ...NO_FILTERS, status: 'AUTO_PUBLISH' });

    expect(buildCases(items, filtered, 2)[0].possiblyIncomplete).toBe(true);
    expect(buildCases(items, [items[0]], 2)[0].possiblyIncomplete).toBe(false);
  });

  it('sin filas no hay nada que marcar', () => {
    expect(possiblyIncompleteKeys([], 200).size).toBe(0);
  });
});

describe('confidencePercentText', () => {
  it('redondea a porcentaje y lo acota entre 0 y 100', () => {
    expect(confidencePercentText(0.784)).toBe('78%');
    expect(confidencePercentText(1.4)).toBe('100%');
    expect(confidencePercentText(-0.2)).toBe('0%');
  });

  it('sin puntaje queda vacio', () => {
    expect(confidencePercentText(null)).toBe('');
  });
});
