import {
  ReadinessSection,
  connectionCardChip,
  idleSlot,
  llmCardChip,
  projectsCardChip,
  projectsReadinessState,
  readinessHeadline,
  sectionReadinessState,
  summarizeReadiness,
  toSectionCardLoadState,
} from './config-readiness';

// Mismo predicado que usa config-center.component.ts: lista solo cuando
// generacion y embeddings estan los dos configurados.
function llmReady(data: { generation: { configured: boolean }; embeddings: { configured: boolean } }): boolean {
  return data.generation.configured && data.embeddings.configured;
}

function section(overrides: Partial<ReadinessSection>): ReadinessSection {
  return { id: 'jsm', label: 'Jira Service Management', state: 'unset', counts: true, ...overrides };
}

describe('summarizeReadiness', () => {
  it('cuenta solo las secciones marcadas como counts', () => {
    // 'extra' es una seccion hipotetica fuera del conteo, no el LLM: el
    // LLM participa siempre del total (ver "las 4 secciones de puesta en
    // marcha" mas abajo).
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

describe('LLM: readiness real con las 4 secciones de puesta en marcha', () => {
  it('idle/loading da unset (igual que JSM/Confluence sin cargar)', () => {
    const state = sectionReadinessState(idleSlot<{ generation: { configured: boolean }; embeddings: { configured: boolean } }>(), llmReady);
    expect(state).toBe('unset');
  });

  it('cargado pero sin ninguna parte configurada da unset', () => {
    const state = sectionReadinessState(
      {
        state: 'loaded',
        data: { generation: { configured: false }, embeddings: { configured: false } },
        errorMessage: null,
      },
      llmReady,
    );
    expect(state).toBe('unset');
  });

  it('con una sola parte configurada todavia da unset (hacen falta las dos)', () => {
    const state = sectionReadinessState(
      {
        state: 'loaded',
        data: { generation: { configured: true }, embeddings: { configured: false } },
        errorMessage: null,
      },
      llmReady,
    );
    expect(state).toBe('unset');
  });

  it('con las dos partes configuradas da ready, sea cual sea el origen (configured ya viene resuelto)', () => {
    const state = sectionReadinessState(
      {
        state: 'loaded',
        data: { generation: { configured: true }, embeddings: { configured: true } },
        errorMessage: null,
      },
      llmReady,
    );
    expect(state).toBe('ready');
  });

  it('error de carga da error', () => {
    const state = sectionReadinessState(
      { state: 'error', data: null, errorMessage: 'x' },
      llmReady,
    );
    expect(state).toBe('error');
  });

  it('3 de 4: JSM, Confluence y Proyectos listos, LLM todavia no configurado', () => {
    const summary = summarizeReadiness([
      section({ id: 'jsm', label: 'Jira Service Management', state: 'ready' }),
      section({ id: 'confluence', label: 'Confluence', state: 'ready' }),
      section({ id: 'projects', label: 'Proyectos', state: 'ready' }),
      section({ id: 'llm', label: 'Modelo de lenguaje', state: 'unset' }),
    ]);

    expect(summary).toEqual({ readyCount: 3, totalCount: 4, showWelcome: false, erroredLabels: [] });
    expect(readinessHeadline(summary)).toBe('3 de 4 secciones listas');
  });

  it('4 de 4: las 4 secciones, incluido el LLM, listas', () => {
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

describe('llmCardChip', () => {
  it('sin dato da "Pendiente" en neutro', () => {
    expect(llmCardChip(null)).toEqual({ label: 'Pendiente', tone: 'neutral' });
  });

  it('con una sola parte configurada sigue en "Pendiente"', () => {
    expect(
      llmCardChip({ generation: { configured: true }, embeddings: { configured: false } }),
    ).toEqual({ label: 'Pendiente', tone: 'neutral' });
  });

  it('con las dos partes configuradas da "Configurado" en tono de exito', () => {
    expect(
      llmCardChip({ generation: { configured: true }, embeddings: { configured: true } }),
    ).toEqual({ label: 'Configurado', tone: 'success' });
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
