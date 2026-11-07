// Ciclo de vida del secreto de los webhooks en memoria. El backend manda el
// secreto enmascarado al consultarlo y completo solo al generarlo o
// regenerarlo (campo masked de la respuesta). Es una funcion pura para poder
// fijar con specs que el valor completo no se conserva mas alla de este
// estado, y el componente solo la aplica y ejecuta los efectos que devuelve.
export type SecretAction = 'load' | 'regenerate';

export interface SecretValue {
  value: string;
  // true: viene enmascarado y no se puede copiar
  masked: boolean;
}

export interface SecretState {
  secret: SecretValue | null;
  pending: SecretAction | null;
  // Una vez destruido ya no acepta nada, ni respuestas tardias
  destroyed: boolean;
}

export const INITIAL_SECRET_STATE: SecretState = { secret: null, pending: null, destroyed: false };

export type SecretEvent =
  | { type: 'request'; action: SecretAction }
  | { type: 'received'; action: SecretAction; secret: SecretValue }
  | { type: 'failed'; action: SecretAction }
  | { type: 'destroy' };

export interface SecretTransition {
  state: SecretState;
  // Accion que hay que pedir al backend
  fetch: SecretAction | null;
}

const IGNORED = (state: SecretState): SecretTransition => ({ state, fetch: null });

export function reduceSecret(state: SecretState, event: SecretEvent): SecretTransition {
  if (state.destroyed) return IGNORED(state);

  switch (event.type) {
    case 'request': {
      // Una operacion a la vez
      if (state.pending !== null) return IGNORED(state);

      if (event.action === 'load') {
        // Con algo en memoria no se vuelve a pedir: el completo recien
        // generado no se pisa con el enmascarado
        if (state.secret !== null) return IGNORED(state);
        return { state: { ...state, pending: 'load' }, fetch: 'load' };
      }

      // Regenerar: el valor que hubiera en memoria deja de valer, se suelta ya
      return { state: { ...state, secret: null, pending: 'regenerate' }, fetch: 'regenerate' };
    }

    case 'received': {
      // Una respuesta que no corresponde a lo pendiente se descarta
      if (state.pending !== event.action) return IGNORED(state);
      // Solo regenerar puede dejar un valor completo: lo que llega al
      // consultar nunca se puede copiar, aunque la respuesta diga otra cosa
      const secret = event.action === 'load' ? { ...event.secret, masked: true } : event.secret;
      return { state: { ...state, secret, pending: null }, fetch: null };
    }

    case 'failed': {
      if (state.pending !== event.action) return IGNORED(state);
      return { state: { ...state, pending: null }, fetch: null };
    }

    case 'destroy':
      return { state: { secret: null, pending: null, destroyed: true }, fetch: null };
  }
}

// Mascara que se muestra mientras todavia no llego el valor
export const SECRET_MASK = '••••••••••••';

// empty: el backend mando un valor vacio, se trata como sin secreto
export type SecretDisplayMode = 'loading' | 'empty' | 'masked' | 'full';

export interface SecretDisplay {
  mode: SecretDisplayMode;
  text: string;
  // Solo el valor completo se puede copiar
  canCopy: boolean;
}

// Lo que muestra la pantalla segun lo que haya en memoria
export function secretDisplay(state: SecretState): SecretDisplay {
  const secret = state.secret;
  if (secret === null) return { mode: 'loading', text: SECRET_MASK, canCopy: false };
  if (secret.value === '') return { mode: 'empty', text: SECRET_MASK, canCopy: false };
  if (secret.masked) return { mode: 'masked', text: secret.value, canCopy: false };
  return { mode: 'full', text: secret.value, canCopy: true };
}
