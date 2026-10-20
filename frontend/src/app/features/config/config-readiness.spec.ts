import {
  ReadinessSection,
  connectionCardChip,
  idleSlot,
  projectsCardChip,
  projectsReadinessState,
  readinessHeadline,
  sectionReadinessState,
  summarizeReadiness,
  toSectionCardLoadState,
} from './config-readiness';

function section(overrides: Partial<ReadinessSection>): ReadinessSection {
  return { id: 'jsm', label: 'Jira Service Management', state: 'unset', counts: true, ...overrides };
}

describe('summarizeReadiness', () => {
  it('cuenta solo las secciones marcadas como counts', () => {
    const summary = summarizeReadiness([
      section({ id: 'jsm', state: 'ready' }),
      section({ id: 'confluence', state: 'ready' }),
      section({ id: 'projects', state: 'pending' }),
      section({ id: 'llm', state: 'unset', counts: false }),
    ]);

    expect(summary).toEqual({ readyCount: 2, totalCount: 3, allUnset: false, erroredLabels: [] });
  });

  it('un pending entre las demas unset rompe el allUnset', () => {
    const summary = summarizeReadiness([
      section({ id: 'jsm', state: 'unset' }),
      section({ id: 'confluence', state: 'unset' }),
      section({ id: 'projects', state: 'pending' }),
    ]);

    expect(summary.allUnset).toBe(false);
  });

  it('allUnset es true solo cuando todas las que cuentan estan en unset', () => {
    const summary = summarizeReadiness([
      section({ id: 'jsm', state: 'unset' }),
      section({ id: 'confluence', state: 'unset' }),
    ]);

    expect(summary.allUnset).toBe(true);
  });

  it('un error no cuenta como listo y queda en erroredLabels', () => {
    const summary = summarizeReadiness([
      section({ id: 'jsm', label: 'Jira Service Management', state: 'ready' }),
      section({ id: 'confluence', label: 'Confluence', state: 'error' }),
      section({ id: 'projects', label: 'Proyectos', state: 'pending' }),
    ]);

    expect(summary.readyCount).toBe(1);
    expect(summary.erroredLabels).toEqual(['Confluence']);
  });
});

describe('readinessHeadline', () => {
  it('arma el texto base sin errores', () => {
    const headline = readinessHeadline(summarizeReadiness([section({ state: 'ready' })]));
    expect(headline).toBe('1 de 1 secciones listas');
  });

  it('agrega las secciones con error como "sin verificar"', () => {
    const headline = readinessHeadline(
      summarizeReadiness([
        section({ id: 'jsm', label: 'Jira Service Management', state: 'ready' }),
        section({ id: 'confluence', label: 'Confluence', state: 'error' }),
      ]),
    );
    expect(headline).toBe('1 de 2 secciones listas, Confluence sin verificar');
  });
});

describe('sectionReadinessState', () => {
  it('idle da unset', () => {
    expect(sectionReadinessState(idleSlot<{ configured: boolean }>(), (d) => d.configured)).toBe('unset');
  });

  it('error da error', () => {
    expect(
      sectionReadinessState({ state: 'error', data: null, errorMessage: 'x' }, (d: { configured: boolean }) => d.configured),
    ).toBe('error');
  });

  it('loaded con dato que cumple isReady da ready', () => {
    expect(
      sectionReadinessState(
        { state: 'loaded', data: { configured: true }, errorMessage: null },
        (d) => d.configured,
      ),
    ).toBe('ready');
  });

  it('loaded con dato que no cumple isReady da unset', () => {
    expect(
      sectionReadinessState(
        { state: 'loaded', data: { configured: false }, errorMessage: null },
        (d) => d.configured,
      ),
    ).toBe('unset');
  });
});

describe('projectsReadinessState', () => {
  it('sin proyectos da pending, nunca unset', () => {
    expect(projectsReadinessState({ state: 'loaded', data: [], errorMessage: null })).toBe('pending');
  });

  it('idle tambien da pending', () => {
    expect(projectsReadinessState(idleSlot())).toBe('pending');
  });

  it('con al menos un proyecto da ready', () => {
    expect(projectsReadinessState({ state: 'loaded', data: [{}], errorMessage: null })).toBe('ready');
  });

  it('error da error', () => {
    expect(projectsReadinessState({ state: 'error', data: null, errorMessage: 'x' })).toBe('error');
  });
});

describe('toSectionCardLoadState', () => {
  it('idle y loading dan loading', () => {
    expect(toSectionCardLoadState('idle')).toBe('loading');
    expect(toSectionCardLoadState('loading')).toBe('loading');
  });

  it('loaded da loaded', () => {
    expect(toSectionCardLoadState('loaded')).toBe('loaded');
  });

  it('error da error', () => {
    expect(toSectionCardLoadState('error')).toBe('error');
  });
});

describe('connectionCardChip', () => {
  it('sin dato da "No conectado" en neutro', () => {
    expect(connectionCardChip(null)).toEqual({ label: 'No conectado', tone: 'neutral' });
  });

  it('configured false da "No conectado" en neutro', () => {
    expect(connectionCardChip({ configured: false })).toEqual({ label: 'No conectado', tone: 'neutral' });
  });

  it('configured true da "Conectado" en tono de exito', () => {
    expect(connectionCardChip({ configured: true })).toEqual({ label: 'Conectado', tone: 'success' });
  });
});

describe('projectsCardChip', () => {
  it('sin proyectos da "0 incorporados" en neutro', () => {
    expect(projectsCardChip([])).toEqual({ label: '0 incorporados', tone: 'neutral' });
  });

  it('sin dato (null) tambien da "0 incorporados" en neutro', () => {
    expect(projectsCardChip(null)).toEqual({ label: '0 incorporados', tone: 'neutral' });
  });

  it('con al menos un proyecto da el conteo en tono informativo', () => {
    expect(projectsCardChip([{}, {}])).toEqual({ label: '2 incorporados', tone: 'info' });
  });
});
