import {
  LLM_SECTION_HAS_BACKEND,
  ReadinessSection,
  connectionCardChip,
  idleSlot,
  llmReadinessState,
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
    // 'extra' es una seccion hipotetica fuera del conteo, no el LLM: el
    // LLM participa siempre del total (ver los tests de llmReadinessState
    // y "secciones de puesta en marcha" mas abajo).
    const summary = summarizeReadiness([
      section({ id: 'jsm', state: 'ready' }),
      section({ id: 'confluence', state: 'ready' }),
      section({ id: 'projects', state: 'pending' }),
      section({ id: 'extra', state: 'unset', counts: false }),
    ]);

    expect(summary).toEqual({ readyCount: 2, totalCount: 3, showWelcome: false, erroredLabels: [] });
  });

  it('sistema recien instalado: JSM/Confluence sin dato y Proyectos pendiente (0 incorporados) muestra bienvenida', () => {
    // Proyectos nunca llega a 'unset' (usa 'pending' incluso con 0
    // incorporados): showWelcome no exige que todas esten literalmente en
    // 'unset', solo que ninguna este lista ni en error.
    const summary = summarizeReadiness([
      section({ id: 'jsm', label: 'Jira Service Management', state: 'unset' }),
      section({ id: 'confluence', label: 'Confluence', state: 'unset' }),
      section({ id: 'projects', label: 'Proyectos', state: 'pending' }),
    ]);

    expect(summary.showWelcome).toBe(true);
  });

  it('con una seccion lista ya no se muestra la bienvenida', () => {
    const summary = summarizeReadiness([
      section({ id: 'jsm', label: 'Jira Service Management', state: 'ready' }),
      section({ id: 'confluence', label: 'Confluence', state: 'unset' }),
      section({ id: 'projects', label: 'Proyectos', state: 'pending' }),
    ]);

    expect(summary.showWelcome).toBe(false);
  });

  it('con una seccion en error de carga tampoco se muestra la bienvenida', () => {
    const summary = summarizeReadiness([
      section({ id: 'jsm', label: 'Jira Service Management', state: 'error' }),
      section({ id: 'confluence', label: 'Confluence', state: 'unset' }),
      section({ id: 'projects', label: 'Proyectos', state: 'pending' }),
    ]);

    expect(summary.showWelcome).toBe(false);
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

describe('llmReadinessState y las 4 secciones de puesta en marcha', () => {
  it('LLM_SECTION_HAS_BACKEND esta en false hoy: sin backend, llmReadinessState da unset', () => {
    expect(LLM_SECTION_HAS_BACKEND).toBe(false);
    expect(llmReadinessState()).toBe('unset');
  });

  it('3 de 4: JSM, Confluence y Proyectos listos, LLM cuenta pero nunca queda listo sin backend', () => {
    const summary = summarizeReadiness([
      section({ id: 'jsm', label: 'Jira Service Management', state: 'ready' }),
      section({ id: 'confluence', label: 'Confluence', state: 'ready' }),
      section({ id: 'projects', label: 'Proyectos', state: 'ready' }),
      section({ id: 'llm', label: 'Modelo de lenguaje', state: llmReadinessState() }),
    ]);

    expect(summary).toEqual({ readyCount: 3, totalCount: 4, showWelcome: false, erroredLabels: [] });
    expect(readinessHeadline(summary)).toBe('3 de 4 secciones listas');
  });

  it('el LLM sin backend no rompe la bienvenida del sistema recien instalado', () => {
    const summary = summarizeReadiness([
      section({ id: 'jsm', label: 'Jira Service Management', state: 'unset' }),
      section({ id: 'confluence', label: 'Confluence', state: 'unset' }),
      section({ id: 'projects', label: 'Proyectos', state: 'pending' }),
      section({ id: 'llm', label: 'Modelo de lenguaje', state: llmReadinessState() }),
    ]);

    expect(summary.showWelcome).toBe(true);
  });

  // Simula el dia que exista el backend del LLM (LLM_SECTION_HAS_BACKEND
  // en true): no depende de la bandera, construye la seccion con 'ready'
  // directamente para probar que summarizeReadiness la cuenta como a
  // cualquier otra.
  it('4 de 4: cuando el LLM tambien tenga backend y quede listo', () => {
    const summary = summarizeReadiness([
      section({ id: 'jsm', label: 'Jira Service Management', state: 'ready' }),
      section({ id: 'confluence', label: 'Confluence', state: 'ready' }),
      section({ id: 'projects', label: 'Proyectos', state: 'ready' }),
      section({ id: 'llm', label: 'Modelo de lenguaje', state: 'ready' }),
    ]);

    expect(summary).toEqual({ readyCount: 4, totalCount: 4, showWelcome: false, erroredLabels: [] });
    expect(readinessHeadline(summary)).toBe('4 de 4 secciones listas');
  });

  it('un error en el LLM no cuenta como listo y queda en erroredLabels, igual que las demas', () => {
    const summary = summarizeReadiness([
      section({ id: 'jsm', label: 'Jira Service Management', state: 'ready' }),
      section({ id: 'confluence', label: 'Confluence', state: 'ready' }),
      section({ id: 'projects', label: 'Proyectos', state: 'ready' }),
      section({ id: 'llm', label: 'Modelo de lenguaje', state: 'error' }),
    ]);

    expect(summary.readyCount).toBe(3);
    expect(summary.erroredLabels).toEqual(['Modelo de lenguaje']);
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
