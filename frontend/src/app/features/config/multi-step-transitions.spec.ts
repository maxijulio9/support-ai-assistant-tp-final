import { HttpErrorResponse } from '@angular/common/http';
import {
  IDLE_MULTI_STEP_STATE,
  MULTI_STEP_DIALOG,
  MULTI_STEP_HELP_PARAGRAPHS,
  MULTI_STEP_TITLE,
  moreInfoLabel,
  multiStepActionFor,
  multiStepDialogProjectLine,
  multiStepErrorMessage,
  multiStepShortHelp,
  multiStepSnackbarMessage,
  multiStepToggleState,
} from './multi-step-transitions';

const http = (status: number, body: unknown = null) => new HttpErrorResponse({ status, error: body });

const ORIGINAL_HELP =
  'Cuando el flujo de Jira no permite llevar el ticket directo al estado que el sistema necesita (por ejemplo, de Waiting for agent a Waiting for customer), el sistema puede pasar por un único estado intermedio, como Work in progress. Cada estado intermedio es un cambio real en Jira y puede disparar notificaciones, automatizaciones o relojes de SLA. Si el segundo paso falla, el ticket queda en el estado intermedio, donde el sistema deja de procesar los comentarios del cliente. La opción más segura es agregar en el flujo de Jira una transición desde cualquier estado hacia el estado que necesita el sistema.';

describe('textos', () => {
  it('el titulo es el aprobado', () => {
    expect(MULTI_STEP_TITLE).toBe('Permitir que el sistema pase por un estado intermedio');
  });

  it('la ayuda en tres parrafos conserva las palabras del texto original', () => {
    expect(MULTI_STEP_HELP_PARAGRAPHS).toHaveLength(3);
    expect(MULTI_STEP_HELP_PARAGRAPHS.join(' ')).toBe(ORIGINAL_HELP);
  });

  it('el dialogo usa Cancelar y Permitir, y muestra el proyecto', () => {
    expect(MULTI_STEP_DIALOG).toEqual({ cancel: 'Cancelar', confirm: 'Permitir' });
    expect(multiStepDialogProjectLine('Soporte Argentina')).toBe('Proyecto: Soporte Argentina');
  });

  it('ningun texto lleva em dash, el caracter de separador, enlaces ni claves de ticket', () => {
    const all = [
      MULTI_STEP_TITLE,
      ...MULTI_STEP_HELP_PARAGRAPHS,
          multiStepShortHelp(true),
      multiStepShortHelp(false),
      moreInfoLabel(true),
      moreInfoLabel(false),
      multiStepSnackbarMessage(true, 'X'),
      multiStepSnackbarMessage(false, 'X'),
      multiStepErrorMessage(http(500)),
      multiStepErrorMessage(http(403)),
    ];
    for (const text of all) expect(text).not.toMatch(/\u2014|\u00B7|https?:|<a|[A-Z]{2,}-\d+/);
  });
});

describe('multiStepShortHelp', () => {
  it('apagada explica que solo usa transiciones directas, y que pasa si se enciende', () => {
    expect(multiStepShortHelp(false)).toContain('Apagada');
    expect(multiStepShortHelp(false)).toContain('solo usa transiciones directas');
    expect(multiStepShortHelp(false)).toContain('Si la encendés');
  });

  it('encendida no promete que lo vaya a hacer siempre: dice que puede', () => {
    expect(multiStepShortHelp(true)).toContain('puede pasar por un único estado intermedio');
    expect(multiStepShortHelp(true)).not.toMatch(/siempre|va a pasar|pasa por/);
  });
});

describe('moreInfoLabel', () => {
  it('cambia segun el estado del desplegable', () => {
    expect(moreInfoLabel(false)).toBe('Más información');
    expect(moreInfoLabel(true)).toBe('Ocultar información');
  });
});

describe('multiStepToggleState', () => {
  it('sin nada en curso muestra el valor guardado y esta habilitada', () => {
    expect(multiStepToggleState(false, IDLE_MULTI_STEP_STATE)).toEqual({ checked: false, disabled: false });
    expect(multiStepToggleState(true, IDLE_MULTI_STEP_STATE)).toEqual({ checked: true, disabled: false });
  });

  it('mientras guarda muestra el valor pedido y esta bloqueada', () => {
    expect(multiStepToggleState(false, { desired: true, locked: true, error: null })).toEqual({ checked: true, disabled: true });
    expect(multiStepToggleState(true, { desired: false, locked: true, error: null })).toEqual({ checked: false, disabled: true });
  });

  it('despues de un error vuelve al valor guardado, y sigue bloqueada el instante anti doble clic', () => {
    expect(multiStepToggleState(false, { desired: null, locked: true, error: 'x' })).toEqual({ checked: false, disabled: true });
    expect(multiStepToggleState(false, { desired: null, locked: false, error: 'x' })).toEqual({ checked: false, disabled: false });
  });

  it('el estado inicial no tiene pedido, bloqueo ni error', () => {
    expect(IDLE_MULTI_STEP_STATE).toEqual({ desired: null, locked: false, error: null });
  });
});

describe('multiStepActionFor', () => {
  it('encender pide confirmacion', () => {
    expect(multiStepActionFor(false, true)).toBe('ask-confirmation');
  });

  it('apagar guarda sin confirmacion', () => {
    expect(multiStepActionFor(true, false)).toBe('save');
  });

  it('sin cambio no hace nada', () => {
    expect(multiStepActionFor(true, true)).toBe('none');
    expect(multiStepActionFor(false, false)).toBe('none');
  });
});

describe('multiStepSnackbarMessage', () => {
  it('encendida: el sistema puede pasar por un estado intermedio, sin prometer que lo hara', () => {
    const message = multiStepSnackbarMessage(true, 'Soporte Argentina');

    expect(message).toBe('Soporte Argentina: el sistema ahora puede pasar por un estado intermedio.');
    expect(message).not.toMatch(/siempre|va a pasar/);
  });

  it('apagada: ya no pasa por estados intermedios', () => {
    expect(multiStepSnackbarMessage(false, 'Soporte Argentina')).toBe(
      'Soporte Argentina: el sistema ya no pasa por estados intermedios.',
    );
  });
});

describe('multiStepErrorMessage', () => {
  it('403 se resuelve por codigo, aunque venga un detail', () => {
    expect(multiStepErrorMessage(http(403, { detail: 'x' }))).toBe(
      'No tenés permiso para cambiar esta opción. Solo lo puede hacer un administrador.',
    );
  });

  it.each([400, 503])('%s muestra el detail del backend', (status) => {
    expect(multiStepErrorMessage(http(status, { detail: 'El proyecto XYZ no existe' }))).toBe('El proyecto XYZ no existe');
  });

  it('503 sin detail usa el texto fijo del servicio', () => {
    expect(multiStepErrorMessage(http(503, {}))).toBe('El servicio no está disponible. Intentá de nuevo en unos minutos.');
  });

  it.each([500, 0, 422])('el resto (%s) es el generico fijo, sin el detail', (status) => {
    expect(multiStepErrorMessage(http(status, { detail: 'interno' }))).toBe('No se pudo cambiar la opción. Intentá de nuevo.');
  });

  it('un error que no es HTTP tambien es el generico', () => {
    expect(multiStepErrorMessage(new Error('x'))).toBe('No se pudo cambiar la opción. Intentá de nuevo.');
  });
});
