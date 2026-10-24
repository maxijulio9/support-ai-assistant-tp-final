import { buildProjectOptions } from './project-options';

const ONBOARDED = [
  { project_id: 'aaaaaaaa-1111', key: 'TARG', name: 'Soporte Argentina' },
  { project_id: 'bbbbbbbb-2222', key: 'TMEX', name: 'Soporte México' },
];

describe('buildProjectOptions', () => {
  it('une por project_id y rotula con nombre y clave', () => {
    expect(buildProjectOptions(['bbbbbbbb-2222', 'aaaaaaaa-1111'], ONBOARDED)).toEqual([
      { projectId: 'bbbbbbbb-2222', label: 'Soporte México (TMEX)' },
      { projectId: 'aaaaaaaa-1111', label: 'Soporte Argentina (TARG)' },
    ]);
  });

  it('conserva el orden de los umbrales, no el de los proyectos configurados', () => {
    const options = buildProjectOptions(['bbbbbbbb-2222', 'aaaaaaaa-1111'], ONBOARDED);

    expect(options.map((option) => option.projectId)).toEqual(['bbbbbbbb-2222', 'aaaaaaaa-1111']);
  });

  it('si la lista de proyectos configurados falla, usa el rotulo corto del id', () => {
    expect(buildProjectOptions(['aaaaaaaa-1111'], null)).toEqual([{ projectId: 'aaaaaaaa-1111', label: 'Proyecto aaaaaaaa' }]);
  });

  it('un proyecto que no figura en la lista usa el rotulo corto y no afecta a los demas', () => {
    const options = buildProjectOptions(['aaaaaaaa-1111', 'cccccccc-3333'], ONBOARDED);

    expect(options[0].label).toBe('Soporte Argentina (TARG)');
    expect(options[1].label).toBe('Proyecto cccccccc');
  });

  it('con solo nombre o solo clave usa el que haya', () => {
    expect(buildProjectOptions(['p1'], [{ project_id: 'p1', key: '', name: 'Soporte' }])[0].label).toBe('Soporte');
    expect(buildProjectOptions(['p2'], [{ project_id: 'p2', key: 'TARG', name: '  ' }])[0].label).toBe('TARG');
  });

  it('con nombre y clave vacios cae en el rotulo corto', () => {
    expect(buildProjectOptions(['abc'], [{ project_id: 'abc', key: '', name: '' }])[0].label).toBe('Proyecto abc');
  });

  it('un id corto no se rellena ni rompe', () => {
    expect(buildProjectOptions(['xy'], null)[0].label).toBe('Proyecto xy');
  });

  it('sin proyectos devuelve una lista vacia', () => {
    expect(buildProjectOptions([], ONBOARDED)).toEqual([]);
  });
});
