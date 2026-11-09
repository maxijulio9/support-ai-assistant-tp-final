import {
  EMPTY_HISTORY_VIEW,
  HistoryViewState,
  parseHistoryParams,
  sanitizeCategory,
  serializeHistoryParams,
  toggleExpanded,
} from './history-url-state';

const STATUSES = ['AUTO_PUBLISH', 'NEEDS_REVIEW', 'ESCALATE'];

function paramsOf(values: Record<string, string>) {
  return { get: (name: string) => values[name] ?? null };
}

describe('parseHistoryParams', () => {
  it('sin parametros devuelve el estado vacio', () => {
    expect(parseHistoryParams(paramsOf({}), STATUSES)).toEqual(EMPTY_HISTORY_VIEW);
  });

  it('lee busqueda, estado, categoria, pagina y casos abiertos', () => {
    const state = parseHistoryParams(
      paramsOf({ q: 'vpn', estado: 'ESCALATE', categoria: 'Red', pagina: '3', abiertos: 'TARG-1,TARG-2' }),
      STATUSES,
    );

    expect(state).toEqual({ term: 'vpn', status: 'ESCALATE', category: 'Red', page: 3, pageSize: 20, expanded: ['TARG-1', 'TARG-2'] });
  });

  it('un estado que no existe se ignora', () => {
    expect(parseHistoryParams(paramsOf({ estado: 'INVENTADO' }), STATUSES).status).toBeNull();
    expect(parseHistoryParams(paramsOf({ estado: 'escalate' }), STATUSES).status).toBeNull();
  });

  it.each(['0', '-2', '1.5', 'abc', '', '99999999999999999999', '3 '])('la pagina %j invalida se ignora', (raw) => {
    expect(parseHistoryParams(paramsOf({ pagina: raw }), STATUSES).page).toBe(1);
  });

  it('los valores vacios o con solo espacios no dejan nada', () => {
    const state = parseHistoryParams(paramsOf({ q: '   ', categoria: '  ', abiertos: ' , ,' }), STATUSES);

    expect(state).toEqual(EMPTY_HISTORY_VIEW);
  });

  it('los casos abiertos se limpian: sin repetidos y sin espacios', () => {
    expect(parseHistoryParams(paramsOf({ abiertos: ' A-1 ,B-2,A-1,,' }), STATUSES).expanded).toEqual(['A-1', 'B-2']);
  });

  it('lee como maximo 50 casos abiertos', () => {
    const many = Array.from({ length: 80 }, (_, index) => `K-${index}`).join(',');

    expect(parseHistoryParams(paramsOf({ abiertos: many }), STATUSES).expanded).toHaveLength(50);
  });
});

describe('serializeHistoryParams', () => {
  it('con el estado vacio no deja ningun parametro', () => {
    expect(Object.values(serializeHistoryParams(EMPTY_HISTORY_VIEW)).every((value) => value === null)).toBe(true);
  });

  it('la pagina 1 no se escribe', () => {
    expect(serializeHistoryParams({ ...EMPTY_HISTORY_VIEW, page: 1 })['pagina']).toBeNull();
    expect(serializeHistoryParams({ ...EMPTY_HISTORY_VIEW, page: 2 })['pagina']).toBe('2');
  });

  it('un filtro vacio queda sin parametro', () => {
    const params = serializeHistoryParams({ ...EMPTY_HISTORY_VIEW, term: '  ', status: '', category: '' });

    expect(params).toEqual({ q: null, estado: null, categoria: null, pagina: null, tamano: null, abiertos: null });
  });

  it('junta los casos abiertos en un solo parametro', () => {
    expect(serializeHistoryParams({ ...EMPTY_HISTORY_VIEW, expanded: ['A-1', 'B-2'] })['abiertos']).toBe('A-1,B-2');
  });

  it('escribir y volver a leer devuelve el mismo estado', () => {
    const state: HistoryViewState = { term: 'no anda', status: 'NEEDS_REVIEW', category: 'Depósitos y retiros', page: 4, pageSize: 50, expanded: ['TARG-9', 'TARG-1'] };
    const written = serializeHistoryParams(state);
    const roundTrip = parseHistoryParams(
      { get: (name) => written[name] ?? null },
      STATUSES,
    );

    expect(roundTrip).toEqual(state);
  });
});

describe('tamano de pagina en la URL', () => {
  it('sin parametro o con uno invalido usa 20', () => {
    expect(parseHistoryParams(paramsOf({}), STATUSES).pageSize).toBe(20);
    expect(parseHistoryParams(paramsOf({ tamano: '15' }), STATUSES).pageSize).toBe(20);
    expect(parseHistoryParams(paramsOf({ tamano: 'abc' }), STATUSES).pageSize).toBe(20);
    expect(parseHistoryParams(paramsOf({ tamano: '' }), STATUSES).pageSize).toBe(20);
  });

  it.each(['10', '20', '50'])('lee el tamano %s', (raw) => {
    expect(parseHistoryParams(paramsOf({ tamano: raw }), STATUSES).pageSize).toBe(Number(raw));
  });

  it('el tamano 20 no se escribe y los otros si', () => {
    expect(serializeHistoryParams({ ...EMPTY_HISTORY_VIEW, pageSize: 20 })['tamano']).toBeNull();
    expect(serializeHistoryParams({ ...EMPTY_HISTORY_VIEW, pageSize: 10 })['tamano']).toBe('10');
    expect(serializeHistoryParams({ ...EMPTY_HISTORY_VIEW, pageSize: 50 })['tamano']).toBe('50');
  });

  it('un tamano invalido en el estado no se escribe', () => {
    expect(serializeHistoryParams({ ...EMPTY_HISTORY_VIEW, pageSize: 7 })['tamano']).toBeNull();
  });
});

describe('sanitizeCategory', () => {
  it('conserva una categoria que existe y descarta la que no', () => {
    expect(sanitizeCategory('Red', ['Acceso', 'Red'])).toBe('Red');
    expect(sanitizeCategory('Otra', ['Acceso', 'Red'])).toBeNull();
    expect(sanitizeCategory(null, ['Acceso'])).toBeNull();
  });
});

describe('toggleExpanded', () => {
  it('abre un caso al final y lo cierra si ya estaba abierto', () => {
    expect(toggleExpanded(['A-1'], 'B-2')).toEqual(['A-1', 'B-2']);
    expect(toggleExpanded(['A-1', 'B-2'], 'A-1')).toEqual(['B-2']);
  });

  it('no modifica la lista original', () => {
    const original = ['A-1'];
    toggleExpanded(original, 'B-2');

    expect(original).toEqual(['A-1']);
  });
});
