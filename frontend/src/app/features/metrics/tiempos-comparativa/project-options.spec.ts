import { buildProjectOptions } from './project-options';

function project(id: string, key: string, name: string) {
  return { project_id: id, key, name };
}

describe('buildProjectOptions', () => {
  it('rotula con nombre y clave', () => {
    expect(buildProjectOptions([project('p1', 'TARG', 'Soporte Argentina')])).toEqual([
      { projectId: 'p1', label: 'Soporte Argentina (TARG)' },
    ]);
  });

  it('ordena por nombre, no por el orden en que llegan', () => {
    const options = buildProjectOptions([
      project('p2', 'TMEX', 'Soporte México'),
      project('p1', 'TARG', 'Soporte Argentina'),
      project('p3', 'TCHI', 'Soporte Chile'),
    ]);

    expect(options.map((option) => option.label)).toEqual([
      'Soporte Argentina (TARG)',
      'Soporte Chile (TCHI)',
      'Soporte México (TMEX)',
    ]);
  });

  it('el orden no distingue mayusculas ni acentos', () => {
    const options = buildProjectOptions([project('p1', 'B', 'zeta'), project('p2', 'A', 'Álamo'), project('p3', 'C', 'alfa')]);

    expect(options.map((option) => option.projectId)).toEqual(['p2', 'p3', 'p1']);
  });

  it('con el mismo nombre desempata por clave', () => {
    const options = buildProjectOptions([project('p1', 'TWO', 'Soporte'), project('p2', 'ONE', 'Soporte')]);

    expect(options.map((option) => option.projectId)).toEqual(['p2', 'p1']);
  });

  it('no modifica la lista recibida', () => {
    const input = [project('p2', 'B', 'Beta'), project('p1', 'A', 'Alfa')];
    buildProjectOptions(input);

    expect(input.map((item) => item.project_id)).toEqual(['p2', 'p1']);
  });

  it('con nombre o clave en blanco usa el que haya', () => {
    expect(buildProjectOptions([project('p1', '  ', 'Soporte')])[0].label).toBe('Soporte');
    expect(buildProjectOptions([project('p2', 'TARG', '')])[0].label).toBe('TARG');
  });

  it('sin proyectos devuelve una lista vacia', () => {
    expect(buildProjectOptions([])).toEqual([]);
  });
});
