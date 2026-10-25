import {
  INITIAL_SECRET_STATE,
  SECRET_MASK,
  SecretAction,
  SecretEvent,
  SecretState,
  isSecretRetainedHidden,
  reduceSecret,
  secretDisplayText,
} from './webhook-secret-state';

const SECRET = 'secreto-de-prueba';

function run(events: SecretEvent[], from: SecretState = INITIAL_SECRET_STATE) {
  let state = from;
  const transitions = events.map((event) => {
    const transition = reduceSecret(state, event);
    state = transition.state;
    return transition;
  });
  return { state, transitions, last: transitions[transitions.length - 1] };
}

const revealed = () => run([{ type: 'request', action: 'reveal' }, { type: 'received', action: 'reveal', secret: SECRET }]).state;
const retained = () => run([{ type: 'request', action: 'regenerate' }, { type: 'received', action: 'regenerate', secret: SECRET }]).state;

describe('ver', () => {
  it('pedir ver sin secreto en memoria lo pide al backend y queda pendiente', () => {
    const { state, last } = run([{ type: 'request', action: 'reveal' }]);

    expect(last.fetch).toBe('reveal');
    expect(state.pending).toBe('reveal');
    expect(state.secret).toBeNull();
  });

  it('al recibirlo queda visible y arranca el temporizador de 30 s', () => {
    const { state, last } = run([{ type: 'request', action: 'reveal' }, { type: 'received', action: 'reveal', secret: SECRET }]);

    expect(state).toMatchObject({ secret: SECRET, visible: true, pending: null });
    expect(last.timer).toBe('start');
  });

  it('ocultar lo borra de memoria y frena el temporizador', () => {
    const { state, last } = run([{ type: 'hide' }], revealed());

    expect(state).toMatchObject({ secret: null, visible: false });
    expect(last.timer).toBe('stop');
  });

  it('al vencer el temporizador lo borra de memoria', () => {
    expect(run([{ type: 'expire' }], revealed()).state).toMatchObject({ secret: null, visible: false });
  });

  it('si falla el pedido no queda nada en memoria y se puede volver a intentar', () => {
    const { state } = run([{ type: 'request', action: 'reveal' }, { type: 'failed', action: 'reveal' }]);

    expect(state).toMatchObject({ secret: null, visible: false, pending: null });
    expect(run([{ type: 'request', action: 'reveal' }], state).last.fetch).toBe('reveal');
  });
});

describe('copiar', () => {
  it('sin secreto en memoria lo pide, lo copia al recibirlo y lo descarta enseguida', () => {
    const { state, transitions } = run([{ type: 'request', action: 'copy' }, { type: 'received', action: 'copy', secret: SECRET }]);

    expect(transitions[0].fetch).toBe('copy');
    expect(transitions[1].copyText).toBe(SECRET);
    expect(state).toMatchObject({ secret: null, visible: false, pending: null });
  });

  it('si ya esta visible lo copia sin pedirlo y sigue visible', () => {
    const start = revealed();
    const { state, last } = run([{ type: 'request', action: 'copy' }], start);

    expect(last.fetch).toBeNull();
    expect(last.copyText).toBe(SECRET);
    expect(state).toEqual(start);
  });

  it('si esta retenido oculto despues de regenerar lo copia sin pedirlo y sigue retenido', () => {
    const start = retained();
    const { state, last } = run([{ type: 'request', action: 'copy' }], start);

    expect(last.fetch).toBeNull();
    expect(last.copyText).toBe(SECRET);
    expect(state).toEqual(start);
  });

  it('si falla el pedido no copia nada ni deja nada en memoria', () => {
    const { state, last } = run([{ type: 'request', action: 'copy' }, { type: 'failed', action: 'copy' }]);

    expect(last.copyText).toBeNull();
    expect(state.secret).toBeNull();
  });
});

describe('regenerar', () => {
  it('pedir regenerar suelta ya el secreto que hubiera en memoria, porque deja de valer', () => {
    const { state, last } = run([{ type: 'request', action: 'regenerate' }], revealed());

    expect(last.fetch).toBe('regenerate');
    expect(state).toMatchObject({ secret: null, visible: false, pending: 'regenerate' });
    expect(last.timer).toBe('stop');
  });

  it('el secreto nuevo queda retenido pero oculto, con el temporizador de 30 s', () => {
    const { state, last } = run([{ type: 'request', action: 'regenerate' }, { type: 'received', action: 'regenerate', secret: SECRET }]);

    expect(state).toMatchObject({ secret: SECRET, visible: false, pending: null });
    expect(isSecretRetainedHidden(state)).toBe(true);
    expect(secretDisplayText(state)).toBe(SECRET_MASK);
    expect(last.timer).toBe('start');
  });

  it('desde la retencion, ver lo muestra sin otro pedido y reinicia el temporizador', () => {
    const { state, last } = run([{ type: 'request', action: 'reveal' }], retained());

    expect(last.fetch).toBeNull();
    expect(state).toMatchObject({ secret: SECRET, visible: true });
    expect(last.timer).toBe('start');
  });

  it('la retencion termina al vencer, al ocultar o al destruir', () => {
    for (const type of ['expire', 'hide', 'destroy'] as const) {
      expect(run([{ type }], retained()).state.secret).toBeNull();
    }
  });

  it('si falla no queda secreto en memoria', () => {
    const { state } = run([{ type: 'request', action: 'regenerate' }, { type: 'failed', action: 'regenerate' }], revealed());

    expect(state).toMatchObject({ secret: null, visible: false, pending: null });
  });
});

describe('una operacion a la vez', () => {
  it.each<SecretAction>(['reveal', 'copy', 'regenerate'])('con %s pendiente se ignora cualquier otro pedido', (pending) => {
    const busy = run([{ type: 'request', action: pending }]).state;

    for (const action of ['reveal', 'copy', 'regenerate'] as const) {
      const { state, fetch, copyText } = reduceSecret(busy, { type: 'request', action });
      expect(state).toEqual(busy);
      expect(fetch).toBeNull();
      expect(copyText).toBeNull();
    }
  });

  it('una respuesta que no es la de la accion pendiente se descarta', () => {
    const busy = run([{ type: 'request', action: 'reveal' }]).state;
    const { state, copyText } = reduceSecret(busy, { type: 'received', action: 'copy', secret: SECRET });

    expect(state).toEqual(busy);
    expect(copyText).toBeNull();
  });

  it('una respuesta sin nada pendiente se descarta y no deja el secreto en memoria', () => {
    const { state } = reduceSecret(INITIAL_SECRET_STATE, { type: 'received', action: 'reveal', secret: SECRET });

    expect(state.secret).toBeNull();
  });
});

describe('destruir', () => {
  it('descarta el secreto, frena el temporizador y marca el estado como destruido', () => {
    const { state, last } = run([{ type: 'destroy' }], revealed());

    expect(state).toEqual({ secret: null, visible: false, pending: null, destroyed: true });
    expect(last.timer).toBe('stop');
  });

  it('una respuesta que llega despues de destruir no vuelve a poner el secreto en memoria', () => {
    const { state, last } = run([
      { type: 'request', action: 'reveal' },
      { type: 'destroy' },
      { type: 'received', action: 'reveal', secret: SECRET },
    ]);

    expect(state.secret).toBeNull();
    expect(last.copyText).toBeNull();
  });

  it('despues de destruir se ignora todo', () => {
    const destroyed = run([{ type: 'destroy' }]).state;

    for (const event of [
      { type: 'request', action: 'reveal' },
      { type: 'request', action: 'copy' },
      { type: 'request', action: 'regenerate' },
      { type: 'received', action: 'copy', secret: SECRET },
      { type: 'hide' },
    ] as SecretEvent[]) {
      const { state, fetch, copyText, timer } = reduceSecret(destroyed, event);
      expect(state).toEqual(destroyed);
      expect([fetch, copyText, timer]).toEqual([null, null, null]);
    }
  });
});

describe('lo que se muestra', () => {
  it('oculto, sin secreto o retenido: solo la mascara', () => {
    expect(secretDisplayText(INITIAL_SECRET_STATE)).toBe(SECRET_MASK);
    expect(secretDisplayText(retained())).toBe(SECRET_MASK);
  });

  it('visible: el valor real', () => {
    expect(secretDisplayText(revealed())).toBe(SECRET);
  });

  it('la mascara es de largo fijo y no contiene el secreto', () => {
    expect(SECRET_MASK.length).toBeGreaterThan(0);
    expect(SECRET_MASK).not.toContain(SECRET);
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

  const ACTIONS: SecretAction[] = ['reveal', 'copy', 'regenerate'];

  function randomEvent(random: () => number): SecretEvent {
    const action = ACTIONS[Math.floor(random() * ACTIONS.length)];
    const kinds = ['request', 'received', 'failed', 'hide', 'expire', 'destroy'];
    const type = kinds[Math.floor(random() * kinds.length)];
    if (type === 'request') return { type, action };
    if (type === 'received') return { type, action, secret: `s${Math.floor(random() * 1000)}` };
    if (type === 'failed') return { type, action };
    return { type } as SecretEvent;
  }

  it('visible implica que hay secreto, y destruido implica que no lo hay', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const random = lcg(seed);
      let state = INITIAL_SECRET_STATE;
      for (let step = 0; step < 60; step++) {
        state = reduceSecret(state, randomEvent(random)).state;
        if (state.visible) expect(state.secret).not.toBeNull();
        if (state.destroyed) expect(state).toEqual({ secret: null, visible: false, pending: null, destroyed: true });
      }
    }
  });

  it('despues de ocultar, vencer o destruir nunca queda secreto en memoria', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const random = lcg(seed);
      let state = INITIAL_SECRET_STATE;
      for (let step = 0; step < 60; step++) {
        const event = randomEvent(random);
        state = reduceSecret(state, event).state;
        if (event.type === 'hide' || event.type === 'expire' || event.type === 'destroy') expect(state.secret).toBeNull();
      }
    }
  });

  it('el valor real solo se muestra si esta visible', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const random = lcg(seed);
      let state = INITIAL_SECRET_STATE;
      for (let step = 0; step < 60; step++) {
        state = reduceSecret(state, randomEvent(random)).state;
        const shown = secretDisplayText(state);
        if (!state.visible) expect(shown).toBe(SECRET_MASK);
        if (state.visible) expect(shown).toBe(state.secret);
      }
    }
  });

  it('copyText solo sale de una copia pedida o de un secreto ya en memoria, nunca de una respuesta ajena', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const random = lcg(seed);
      let state = INITIAL_SECRET_STATE;
      for (let step = 0; step < 60; step++) {
        const event = randomEvent(random);
        const transition = reduceSecret(state, event);
        if (transition.copyText !== null) {
          const fromReceivedCopy = event.type === 'received' && event.action === 'copy' && state.pending === 'copy';
          const fromMemory = event.type === 'request' && event.action === 'copy' && state.secret === transition.copyText;
          expect(fromReceivedCopy || fromMemory).toBe(true);
        }
        state = transition.state;
      }
    }
  });
});
