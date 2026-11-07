import {
  INITIAL_SECRET_STATE,
  SECRET_MASK,
  SecretAction,
  SecretEvent,
  SecretState,
  reduceSecret,
  secretDisplay,
} from './webhook-secret-state';

const MASKED = { value: '********abcd', masked: true };
const FULL = { value: 'secreto-completo-de-prueba', masked: false };

function run(events: SecretEvent[], from: SecretState = INITIAL_SECRET_STATE) {
  let state = from;
  const transitions = events.map((event) => {
    const transition = reduceSecret(state, event);
    state = transition.state;
    return transition;
  });
  return { state, transitions, last: transitions[transitions.length - 1] };
}

const loaded = () =>
  run([
    { type: 'request', action: 'load' },
    { type: 'received', action: 'load', secret: MASKED },
  ]).state;
const regenerated = () =>
  run([
    { type: 'request', action: 'regenerate' },
    { type: 'received', action: 'regenerate', secret: FULL },
  ]).state;

describe('cargar el secreto enmascarado', () => {
  it('pedirlo sin nada en memoria lo pide al backend y queda pendiente', () => {
    const { state, last } = run([{ type: 'request', action: 'load' }]);

    expect(last.fetch).toBe('load');
    expect(state).toMatchObject({ pending: 'load', secret: null });
  });

  it('al recibirlo queda en memoria y deja de estar pendiente', () => {
    const state = loaded();

    expect(state).toMatchObject({ secret: MASKED, pending: null });
  });

  it('lo que llega al consultar nunca se puede copiar, aunque diga masked false', () => {
    const { state } = run([
      { type: 'request', action: 'load' },
      { type: 'received', action: 'load', secret: FULL },
    ]);

    expect(state.secret).toEqual({ value: FULL.value, masked: true });
    expect(secretDisplay(state).canCopy).toBe(false);
  });

  it('con algo en memoria no se vuelve a pedir', () => {
    const { last } = run([{ type: 'request', action: 'load' }], loaded());

    expect(last.fetch).toBeNull();
  });

  it('el completo recien regenerado no se pisa con una carga', () => {
    const { state, last } = run([{ type: 'request', action: 'load' }], regenerated());

    expect(last.fetch).toBeNull();
    expect(state.secret).toEqual(FULL);
  });

  it('si falla, vuelve a no estar pendiente y no deja nada en memoria', () => {
    const { state } = run([
      { type: 'request', action: 'load' },
      { type: 'failed', action: 'load' },
    ]);

    expect(state).toMatchObject({ pending: null, secret: null });
  });
});

describe('regenerar', () => {
  it('lo pide al backend y suelta lo que hubiera en memoria', () => {
    const { state, last } = run([{ type: 'request', action: 'regenerate' }], loaded());

    expect(last.fetch).toBe('regenerate');
    expect(state).toMatchObject({ pending: 'regenerate', secret: null });
  });

  it('suelta tambien un completo anterior, que deja de valer', () => {
    const { state } = run([{ type: 'request', action: 'regenerate' }], regenerated());

    expect(state.secret).toBeNull();
  });

  it('al recibirlo queda el valor completo en memoria', () => {
    expect(regenerated()).toMatchObject({ secret: FULL, pending: null });
  });

  it('si falla, no queda nada en memoria', () => {
    const { state } = run([
      { type: 'request', action: 'regenerate' },
      { type: 'failed', action: 'regenerate' },
    ]);

    expect(state).toMatchObject({ secret: null, pending: null });
  });
});

describe('una operacion a la vez', () => {
  it('mientras hay algo pendiente se ignoran los pedidos nuevos', () => {
    const pending = run([{ type: 'request', action: 'load' }]).state;

    expect(run([{ type: 'request', action: 'regenerate' }], pending).last.fetch).toBeNull();
    expect(run([{ type: 'request', action: 'load' }], pending).last.fetch).toBeNull();
  });

  it('una respuesta que no corresponde a lo pendiente se descarta', () => {
    const pending = run([{ type: 'request', action: 'load' }]).state;
    const { state } = run([{ type: 'received', action: 'regenerate', secret: FULL }], pending);

    expect(state).toEqual(pending);
  });

  it('una respuesta sin nada pendiente se descarta', () => {
    const { state } = run([{ type: 'received', action: 'regenerate', secret: FULL }]);

    expect(state.secret).toBeNull();
  });
});

describe('destruir', () => {
  it('suelta el valor completo de la memoria', () => {
    const { state } = run([{ type: 'destroy' }], regenerated());

    expect(state.secret).toBeNull();
    expect(state.destroyed).toBe(true);
  });

  it('una respuesta tardia despues de destruir no vuelve a poner nada', () => {
    const { state } = run(
      [
        { type: 'request', action: 'regenerate' },
        { type: 'destroy' },
        { type: 'received', action: 'regenerate', secret: FULL },
      ],
      INITIAL_SECRET_STATE,
    );

    expect(state.secret).toBeNull();
  });

  it('despues de destruir no se pide nada', () => {
    const destroyed = run([{ type: 'destroy' }]).state;

    expect(run([{ type: 'request', action: 'load' }], destroyed).last.fetch).toBeNull();
    expect(run([{ type: 'request', action: 'regenerate' }], destroyed).last.fetch).toBeNull();
  });
});

describe('secretDisplay', () => {
  it('sin nada en memoria muestra la mascara y no se puede copiar', () => {
    expect(secretDisplay(INITIAL_SECRET_STATE)).toEqual({ mode: 'loading', text: SECRET_MASK, canCopy: false });
  });

  it('enmascarado muestra el valor del backend y no se puede copiar', () => {
    expect(secretDisplay(loaded())).toEqual({ mode: 'masked', text: MASKED.value, canCopy: false });
  });

  it('un valor vacio es "sin secreto": muestra la mascara y no se puede copiar', () => {
    for (const masked of [false, true]) {
      const state = run([
        { type: 'request', action: 'regenerate' },
        { type: 'received', action: 'regenerate', secret: { value: '', masked } },
      ]).state;

      expect(secretDisplay(state)).toEqual({ mode: 'empty', text: SECRET_MASK, canCopy: false });
    }
  });

  it('completo muestra el valor y se puede copiar', () => {
    expect(secretDisplay(regenerated())).toEqual({ mode: 'full', text: FULL.value, canCopy: true });
  });
});

describe('invariantes con secuencias de eventos al azar', () => {
  // Generador determinista para que el spec sea reproducible
  function lcg(seed: number) {
    let value = seed;
    return () => {
      value = (value * 1664525 + 1013904223) % 4294967296;
      return value / 4294967296;
    };
  }

  const ACTIONS: SecretAction[] = ['load', 'regenerate'];

  function randomEvent(random: () => number): SecretEvent {
    const action = ACTIONS[Math.floor(random() * ACTIONS.length)];
    const kinds = ['request', 'received', 'failed', 'destroy'];
    const type = kinds[Math.floor(random() * kinds.length)];
    if (type === 'request' || type === 'failed') return { type, action } as SecretEvent;
    if (type === 'received') {
      const value = random() < 0.1 ? '' : `s${Math.floor(random() * 1000)}`;
      return { type, action, secret: { value, masked: random() < 0.5 } };
    }
    return { type: 'destroy' };
  }

  function forEachStep(check: (before: SecretState, event: SecretEvent, after: SecretState) => void) {
    for (let seed = 1; seed <= 200; seed++) {
      const random = lcg(seed);
      let state = INITIAL_SECRET_STATE;
      for (let step = 0; step < 60; step++) {
        const event = randomEvent(random);
        const next = reduceSecret(state, event).state;
        check(state, event, next);
        state = next;
      }
    }
  }

  it('despues de destruir nunca hay secreto en memoria', () => {
    forEachStep((_before, _event, after) => {
      if (after.destroyed) expect(after).toEqual({ secret: null, pending: null, destroyed: true });
    });
  });

  it('un valor enmascarado nunca se puede copiar', () => {
    forEachStep((_before, _event, after) => {
      const display = secretDisplay(after);
      if (after.secret?.masked) expect(display.canCopy).toBe(false);
      if (display.canCopy) expect(after.secret).toMatchObject({ masked: false });
    });
  });

  it('solo un received de regenerar puede dejar un valor completo', () => {
    forEachStep((before, event, after) => {
      const isFull = after.secret !== null && !after.secret.masked;
      if (isFull && after.secret !== before.secret) {
        expect(event).toMatchObject({ type: 'received', action: 'regenerate' });
        expect(before.pending).toBe('regenerate');
      }
    });
  });
});
