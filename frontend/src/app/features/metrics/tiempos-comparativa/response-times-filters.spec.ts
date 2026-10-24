import { ALL_PROJECTS, buildResponseTimesFilters, resolveProjectSelection } from './response-times-filters';

describe('resolveProjectSelection', () => {
  const ids = ['p1', 'p2', 'p3'];

  it('sin param cae en el primer proyecto', () => {
    expect(resolveProjectSelection(null, ids)).toBe('p1');
  });

  it('un id de la lista se respeta', () => {
    expect(resolveProjectSelection('p2', ids)).toBe('p2');
  });

  it('"all" es un valor explicito y se respeta aunque haya proyectos', () => {
    expect(resolveProjectSelection(ALL_PROJECTS, ids)).toBe(ALL_PROJECTS);
  });

  it('un id que no esta en la lista cae en el primer proyecto', () => {
    expect(resolveProjectSelection('viejo', ids)).toBe('p1');
  });

  it('un param vacio cae en el primer proyecto', () => {
    expect(resolveProjectSelection('', ids)).toBe('p1');
  });

  it('sin proyectos queda en todos, sea cual sea el param', () => {
    expect(resolveProjectSelection(null, [])).toBe(ALL_PROJECTS);
    expect(resolveProjectSelection('p1', [])).toBe(ALL_PROJECTS);
  });
});

describe('buildResponseTimesFilters', () => {
  it('"all" no manda project_id', () => {
    expect(buildResponseTimesFilters(ALL_PROJECTS, null)).toEqual({ projectId: null, category: null });
  });

  it('un proyecto manda su id y conserva la categoria', () => {
    expect(buildResponseTimesFilters('p2', 'Acceso')).toEqual({ projectId: 'p2', category: 'Acceso' });
  });
});
