import {
  LlmFormSnapshot,
  buildLlmSavePayload,
  canLoadChatModels,
  canSaveLlmConfiguration,
  effectiveKeyEditedFlag,
  generationKeyFor,
  modelsStillValid,
  preselectModel,
  savedModelCandidate,
} from './llm-form';

function snapshot(overrides: Partial<LlmFormSnapshot> = {}): LlmFormSnapshot {
  return {
    embeddingsApiKey: 'sk-openai-123',
    generationProvider: 'openai',
    generationApiKey: '',
    chatModelsLoaded: true,
    generationModel: 'gpt-4.1-mini',
    ...overrides,
  };
}

describe('generationKeyFor', () => {
  it('usa la clave de OpenAI cuando el proveedor es openai', () => {
    expect(generationKeyFor('openai', 'clave-openai', 'clave-gemini')).toBe('clave-openai');
  });

  it('usa la clave de Gemini cuando el proveedor es gemini', () => {
    expect(generationKeyFor('gemini', 'clave-openai', 'clave-gemini')).toBe('clave-gemini');
  });
});

describe('canLoadChatModels', () => {
  it('falso si la clave que corresponde al proveedor esta vacia (openai)', () => {
    expect(canLoadChatModels('openai', '', '')).toBe(false);
  });

  it('falso si la clave que corresponde al proveedor esta vacia (gemini, aunque haya clave de OpenAI)', () => {
    expect(canLoadChatModels('gemini', 'clave-openai', '')).toBe(false);
  });

  it('verdadero si la clave que corresponde al proveedor esta escrita', () => {
    expect(canLoadChatModels('openai', 'clave-openai', '')).toBe(true);
    expect(canLoadChatModels('gemini', 'clave-openai', 'clave-gemini')).toBe(true);
  });

  it('una clave de solo espacios no cuenta como escrita', () => {
    expect(canLoadChatModels('openai', '   ', '')).toBe(false);
  });
});

describe('effectiveKeyEditedFlag', () => {
  it('con proveedor openai, mira la marca de la clave de OpenAI', () => {
    expect(effectiveKeyEditedFlag('openai', true, false)).toBe(true);
    expect(effectiveKeyEditedFlag('openai', false, true)).toBe(false);
  });

  it('con proveedor gemini, mira la marca de la clave de Gemini', () => {
    expect(effectiveKeyEditedFlag('gemini', false, true)).toBe(true);
    expect(effectiveKeyEditedFlag('gemini', true, false)).toBe(false);
  });
});

describe('modelsStillValid', () => {
  it('invalida si nunca se cargo una lista', () => {
    expect(modelsStillValid(null, 'openai', false)).toBe(false);
  });

  it('invalida si cambio el proveedor desde que se cargo', () => {
    expect(modelsStillValid('openai', 'gemini', false)).toBe(false);
  });

  it('invalida si la clave efectiva se edito desde que se cargo, sin importar su valor', () => {
    expect(modelsStillValid('openai', 'openai', true)).toBe(false);
  });

  it('sigue valida si el proveedor no cambio y la clave efectiva no se toco', () => {
    expect(modelsStillValid('openai', 'openai', false)).toBe(true);
  });
});

describe('canSaveLlmConfiguration', () => {
  it('falso sin la clave de OpenAI', () => {
    expect(canSaveLlmConfiguration(snapshot({ embeddingsApiKey: '' }))).toBe(false);
  });

  it('falso con proveedor gemini y sin su clave', () => {
    expect(
      canSaveLlmConfiguration(
        snapshot({ generationProvider: 'gemini', generationApiKey: '', generationModel: 'gemini-1.5-pro' }),
      ),
    ).toBe(false);
  });

  it('falso si la lista de modelos no se cargo', () => {
    expect(canSaveLlmConfiguration(snapshot({ chatModelsLoaded: false }))).toBe(false);
  });

  it('falso si no hay modelo elegido (incluye el caso de una lista vacia: 200 sin modelos)', () => {
    expect(canSaveLlmConfiguration(snapshot({ generationModel: null }))).toBe(false);
  });

  it('verdadero con proveedor openai, sin exigir la clave de Gemini', () => {
    expect(canSaveLlmConfiguration(snapshot({ generationProvider: 'openai', generationApiKey: '' }))).toBe(true);
  });

  it('verdadero con proveedor gemini y su clave presente', () => {
    expect(
      canSaveLlmConfiguration(
        snapshot({ generationProvider: 'gemini', generationApiKey: 'clave-gemini', generationModel: 'gemini-1.5-pro' }),
      ),
    ).toBe(true);
  });
});

describe('buildLlmSavePayload', () => {
  it('con proveedor openai no incluye generation.api_key', () => {
    const payload = buildLlmSavePayload({
      embeddingsApiKey: 'clave-openai',
      generationProvider: 'openai',
      generationApiKey: '',
      generationModel: 'gpt-4.1-mini',
    });

    expect(payload).toEqual({
      generation: { provider: 'openai', model: 'gpt-4.1-mini' },
      embeddings: { api_key: 'clave-openai' },
    });
    expect(payload.generation.api_key).toBeUndefined();
  });

  it('con proveedor gemini incluye generation.api_key', () => {
    const payload = buildLlmSavePayload({
      embeddingsApiKey: 'clave-openai',
      generationProvider: 'gemini',
      generationApiKey: 'clave-gemini',
      generationModel: 'gemini-1.5-pro',
    });

    expect(payload).toEqual({
      generation: { provider: 'gemini', model: 'gemini-1.5-pro', api_key: 'clave-gemini' },
      embeddings: { api_key: 'clave-openai' },
    });
  });

  it('embeddings.api_key siempre esta presente', () => {
    const payload = buildLlmSavePayload({
      embeddingsApiKey: 'clave-openai',
      generationProvider: 'gemini',
      generationApiKey: 'clave-gemini',
      generationModel: 'gemini-1.5-pro',
    });

    expect(payload.embeddings.api_key).toBe('clave-openai');
  });
});

describe('savedModelCandidate', () => {
  it('null si nunca hubo nada configurado', () => {
    expect(savedModelCandidate('openai', null, null)).toBeNull();
  });

  it('null si el proveedor elegido no coincide con el ya configurado', () => {
    expect(savedModelCandidate('gemini', 'openai', 'gpt-4.1-mini')).toBeNull();
  });

  it('devuelve el modelo guardado si el proveedor elegido coincide', () => {
    expect(savedModelCandidate('openai', 'openai', 'gpt-4.1-mini')).toBe('gpt-4.1-mini');
  });
});

describe('preselectModel', () => {
  it('null si no hay candidato', () => {
    expect(preselectModel(['gpt-4.1-mini', 'gpt-4o'], null)).toBeNull();
  });

  it('null si el candidato no esta en la lista nueva', () => {
    expect(preselectModel(['gpt-4o'], 'gpt-4.1-mini')).toBeNull();
  });

  it('devuelve el candidato si esta en la lista', () => {
    expect(preselectModel(['gpt-4.1-mini', 'gpt-4o'], 'gpt-4.1-mini')).toBe('gpt-4.1-mini');
  });

  it('con una lista vacia (200 sin modelos) nunca preselecciona nada', () => {
    expect(preselectModel([], 'gpt-4.1-mini')).toBeNull();
  });
});
