import { buildProjectOptions } from './project-options';

function project(id: string, key: string, name: string, is_active?: boolean) {
  return is_active === undefined ? { project_id: id, key, name } : { project_id: id, key, name, is_active };
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

  it('un proyecto inactivo lleva (inactivo) despues del nombre y antes de la clave', () => {
    expect(buildProjectOptions([project('p1', 'TARG', 'Soporte Argentina', false)])[0].label).toBe(
      'Soporte Argentina (inactivo) (TARG)',
    );
  });

  it('uno activo, o sin la marca, no lleva nada extra', () => {
    expect(buildProjectOptions([project('p1', 'TARG', 'Soporte Argentina', true)])[0].label).toBe('Soporte Argentina (TARG)');
    expect(buildProjectOptions([project('p2', 'TMEX', 'Soporte México')])[0].label).toBe('Soporte México (TMEX)');
  });

  it('los activos van primero y los inactivos al final, cada grupo por nombre', () => {
    const options = buildProjectOptions([
      project('p1', 'A', 'Alfa', false),
      project('p2', 'Z', 'Zeta', true),
      project('p3', 'B', 'Beta', false),
      project('p4', 'M', 'Mu', true),
    ]);

    expect(options.map((option) => option.projectId)).toEqual(['p4', 'p2', 'p1', 'p3']);
  });

  it('el primero de la lista es el primer activo, que es el que queda preseleccionado', () => {
    const options = buildProjectOptions([project('p1', 'A', 'Alfa', false), project('p2', 'Z', 'Zeta', true)]);

    expect(options[0].projectId).toBe('p2');
  });

  it('si todos estan inactivos, el primero por nombre', () => {
    const options = buildProjectOptions([project('p2', 'Z', 'Zeta', false), project('p1', 'A', 'Alfa', false)]);

    expect(options.map((option) => option.projectId)).toEqual(['p1', 'p2']);
  });

  it('con nombre o clave en blanco, la marca se pone igual', () => {
    expect(buildProjectOptions([project('p1', 'TARG', '', false)])[0].label).toBe('TARG (inactivo)');
    expect(buildProjectOptions([project('p2', '', 'Soporte', false)])[0].label).toBe('Soporte (inactivo)');
  });
});
