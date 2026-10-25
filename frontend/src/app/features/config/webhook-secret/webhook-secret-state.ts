// Ciclo de vida del secreto de los webhooks en memoria. El secreto solo
// existe en este estado mientras se muestra o durante la retencion corta
// despues de regenerar: en cualquier otro caso es null. Es una funcion pura
// para poder fijar con specs cuando se descarta, y el componente solo la
// aplica y ejecuta los efectos que devuelve.
export type SecretAction = 'reveal' | 'copy' | 'regenerate';

export interface SecretState {
  secret: string | null;
  // Solo se muestra el valor real si esto es true
  visible: boolean;
  pending: SecretAction | null;
  // Una vez destruido ya no acepta nada, ni respuestas tardias
  destroyed: boolean;
}

export const INITIAL_SECRET_STATE: SecretState = { secret: null, visible: false, pending: null, destroyed: false };

export type SecretEvent =
  | { type: 'request'; action: SecretAction }
  | { type: 'received'; action: SecretAction; secret: string }
  | { type: 'failed'; action: SecretAction }
  | { type: 'hide' }
  | { type: 'expire' }
  | { type: 'destroy' };

export interface SecretTransition {
  state: SecretState;
  // Accion que hay que pedir al backend
  fetch: SecretAction | null;
  // Texto que hay que poner en el portapapeles ahora
  copyText: string | null;
  // Temporizador de 30 s: reiniciarlo o frenarlo
  timer: 'start' | 'stop' | null;
}

const IGNORED = (state: SecretState): SecretTransition => ({ state, fetch: null, copyText: null, timer: null });

const CLEARED: Pick<SecretState, 'secret' | 'visible'> = { secret: null, visible: false };

export function reduceSecret(state: SecretState, event: SecretEvent): SecretTransition {
  if (state.destroyed) return IGNORED(state);

  switch (event.type) {
    case 'request': {
      // Una operacion a la vez
      if (state.pending !== null) return IGNORED(state);

      if (event.action === 'reveal') {
        // Si quedo retenido despues de regenerar, se muestra sin otro pedido
        if (state.secret !== null) {
          return { state: { ...state, visible: true }, fetch: null, copyText: null, timer: 'start' };
        }
        return { state: { ...state, pending: 'reveal' }, fetch: 'reveal', copyText: null, timer: null };
      }

      if (event.action === 'copy') {
        if (state.secret !== null) {
          return { state, fetch: null, copyText: state.secret, timer: null };
        }
        return { state: { ...state, pending: 'copy' }, fetch: 'copy', copyText: null, timer: null };
      }

      // Regenerar: el secreto que hubiera en memoria deja de valer, se suelta ya
      return { state: { ...state, ...CLEARED, pending: 'regenerate' }, fetch: 'regenerate', copyText: null, timer: 'stop' };
    }

    case 'received': {
      // Una respuesta que no corresponde a lo pendiente se descarta
      if (state.pending !== event.action) return IGNORED(state);

      if (event.action === 'reveal') {
        return { state: { ...state, secret: event.secret, visible: true, pending: null }, fetch: null, copyText: null, timer: 'start' };
      }

      if (event.action === 'copy') {
        // Se copia y se descarta enseguida: no estaba visible ni retenido
        return { state: { ...state, ...CLEARED, pending: null }, fetch: null, copyText: event.secret, timer: null };
      }

      // Regenerar: queda retenido pero oculto, por tiempo limitado
      return {
        state: { ...state, secret: event.secret, visible: false, pending: null },
        fetch: null,
        copyText: null,
        timer: 'start',
      };
    }

    case 'failed': {
      if (state.pending !== event.action) return IGNORED(state);
      return { state: { ...state, pending: null }, fetch: null, copyText: null, timer: null };
    }

    case 'hide':
    case 'expire':
      return { state: { ...state, ...CLEARED }, fetch: null, copyText: null, timer: 'stop' };

    case 'destroy':
      return {
        state: { secret: null, visible: false, pending: null, destroyed: true },
        fetch: null,
        copyText: null,
        timer: 'stop',
      };
  }
}

// Mascara de largo fijo: no revela el largo del secreto
export const SECRET_MASK = '••••••••••••';

// Lo que muestra la pantalla: el valor real solo si esta visible
export function secretDisplayText(state: SecretState): string {
  return state.visible && state.secret !== null ? state.secret : SECRET_MASK;
}

// Hay un secreto en memoria que no se esta mostrando (retencion despues de regenerar)
export function isSecretRetainedHidden(state: SecretState): boolean {
  return state.secret !== null && !state.visible;
}
