// Logica pura del formulario de Modelo de lenguaje. Los tipos de aca abajo
// son locales y minimos (LlmProvider, LlmFormSnapshot, LlmSavePayload):
// cuando exista el cliente generado del contrato real se reemplazan por los
// suyos sin tocar la forma de estas funciones.
export type LlmProvider = 'openai' | 'gemini';

export interface LlmFormSnapshot {
  embeddingsApiKey: string;
  generationProvider: LlmProvider;
  generationApiKey: string;
  chatModelsLoaded: boolean;
  generationModel: string | null;
}

export interface LlmSavePayload {
  generation: {
    provider: LlmProvider;
    model: string;
    api_key?: string;
  };
  embeddings: {
    api_key: string;
  };
}

// La clave que corresponde usar para "Cargar modelos" segun el proveedor
// elegido: la de OpenAI (la del bloque de arriba) si se genera con OpenAI,
// la de Gemini si no. Uso transitorio para armar el pedido en el momento
// del click: no se guarda en ninguna propiedad ni se loguea.
export function generationKeyFor(
  provider: LlmProvider,
  embeddingsApiKey: string,
  generationApiKey: string,
): string {
  return provider === 'gemini' ? generationApiKey : embeddingsApiKey;
}

// "Cargar modelos" solo se habilita si la clave que le corresponde al
// proveedor elegido ya esta escrita.
export function canLoadChatModels(
  provider: LlmProvider,
  embeddingsApiKey: string,
  generationApiKey: string,
): boolean {
  return generationKeyFor(provider, embeddingsApiKey, generationApiKey).trim().length > 0;
}

// De las dos claves, cual es la "efectiva" para el proveedor elegido: sirve
// para saber si edito la que importa, sin comparar el valor de ninguna.
export function effectiveKeyEditedFlag(
  provider: LlmProvider,
  embeddingsKeyEdited: boolean,
  generationKeyEdited: boolean,
): boolean {
  return provider === 'gemini' ? generationKeyEdited : embeddingsKeyEdited;
}

// Si la lista de modelos cargada sigue sirviendo. No recibe ni compara
// ninguna clave: solo el proveedor con el que se cargo (loadedForProvider,
// un dato que no es secreto) y una marca booleana de si la clave efectiva
// se toco despues de esa carga (effectiveKeyEditedFlag se encarga de
// resolver cual de las dos es, sin exponer su valor).
export function modelsStillValid(
  loadedForProvider: LlmProvider | null,
  currentProvider: LlmProvider,
  effectiveKeyEdited: boolean,
): boolean {
  if (loadedForProvider === null) return false;
  if (loadedForProvider !== currentProvider) return false;
  return !effectiveKeyEdited;
}

// Las tres condiciones de arriba (clave de OpenAI, lista cargada, modelo
// elegido) mas la clave de Gemini si corresponde. Si "Cargar modelos" dio
// una lista vacia, generationModel queda null y esto ya da false solo: no
// hace falta un chequeo aparte para ese caso.
export function canSaveLlmConfiguration(form: LlmFormSnapshot): boolean {
  if (!form.embeddingsApiKey.trim()) return false;
  if (form.generationProvider === 'gemini' && !form.generationApiKey.trim()) return false;
  if (!form.chatModelsLoaded) return false;
  if (!form.generationModel) return false;
  return true;
}

export function buildLlmSavePayload(form: {
  embeddingsApiKey: string;
  generationProvider: LlmProvider;
  generationApiKey: string;
  generationModel: string;
}): LlmSavePayload {
  const generation: LlmSavePayload['generation'] = {
    provider: form.generationProvider,
    model: form.generationModel,
  };
  if (form.generationProvider === 'gemini') {
    generation.api_key = form.generationApiKey;
  }
  return { generation, embeddings: { api_key: form.embeddingsApiKey } };
}

// El modelo guardado solo se propone para preseleccionar si el proveedor
// elegido ahora es el mismo que ya estaba configurado; si el admin cambio
// de proveedor, no se reintenta adivinar.
export function savedModelCandidate(
  currentProvider: LlmProvider,
  configuredProvider: LlmProvider | null,
  configuredModel: string | null,
): string | null {
  if (configuredProvider === null) return null;
  return currentProvider === configuredProvider ? configuredModel : null;
}

// Preselecciona el candidato solo si aparece en la lista recien cargada.
export function preselectModel(chatModels: string[], savedModel: string | null): string | null {
  return savedModel !== null && chatModels.includes(savedModel) ? savedModel : null;
}
