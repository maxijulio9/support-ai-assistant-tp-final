import {
  MAX_EDITED_RESPONSE_LENGTH,
  NOT_PENDING_MESSAGE,
  VERIFY_IN_JIRA_MESSAGE,
  approveUnavailableMessage,
  buildApproveBody,
  buildDiscardBody,
  buildRegenerateBody,
  isEditedResponseValid,
  normalizeResponseText,
  resolveEditedResponse,
  reviewActionErrorMessage,
  regenerateErrorResolution,
  reviewActionErrorOutcome,
} from './review-actions';

describe('normalizeResponseText', () => {
  it('recorta espacios al principio y al final', () => {
    expect(normalizeResponseText('  hola  ')).toBe('hola');
  });
});

describe('isEditedResponseValid', () => {
  it('invalido si queda vacio tras recortar', () => {
    expect(isEditedResponseValid('   ')).toBe(false);
    expect(isEditedResponseValid('')).toBe(false);
  });

  it('invalido si supera el maximo de caracteres', () => {
    expect(isEditedResponseValid('a'.repeat(MAX_EDITED_RESPONSE_LENGTH + 1))).toBe(false);
  });

  it('valido justo en el limite', () => {
    expect(isEditedResponseValid('a'.repeat(MAX_EDITED_RESPONSE_LENGTH))).toBe(true);
  });

  it('valido con texto normal', () => {
    expect(isEditedResponseValid('Respuesta editada')).toBe(true);
  });
});

describe('resolveEditedResponse', () => {
  it('null si el texto editado es identico al generado', () => {
    expect(resolveEditedResponse('Hola, como estas', 'Hola, como estas')).toBeNull();
  });

  it('null si solo difieren en espacios al principio/final', () => {
    expect(resolveEditedResponse('  Hola, como estas  ', 'Hola, como estas')).toBeNull();
  });

  it('devuelve el texto recortado si es distinto del generado', () => {
    expect(resolveEditedResponse('  Hola, como te va  ', 'Hola, como estas')).toBe('Hola, como te va');
  });

  it('trata el generado null como texto vacio', () => {
    expect(resolveEditedResponse('Respuesta nueva', null)).toBe('Respuesta nueva');
  });

  it('null si el generado es null y el editado queda vacio tras recortar', () => {
    expect(resolveEditedResponse('   ', null)).toBeNull();
  });
});

describe('buildApproveBody', () => {
  it('sin edicion: body vacio', () => {
    expect(buildApproveBody(null)).toEqual({});
  });

  it('con edicion: solo edited_response', () => {
    expect(buildApproveBody('Texto editado')).toEqual({ edited_response: 'Texto editado' });
  });

  it('nunca incluye un campo de revisor: el revisor sale del token', () => {
    expect(Object.keys(buildApproveBody('Texto editado'))).not.toContain('reviewed_by');
    expect(Object.keys(buildApproveBody(null))).not.toContain('reviewed_by');
  });
});

describe('buildRegenerateBody', () => {
  it('manda solo el motivo, tal cual viene', () => {
    expect(buildRegenerateBody('Falta contexto')).toEqual({ rejection_reason: 'Falta contexto' });
  });

  it('nunca incluye un campo de revisor: el revisor sale del token', () => {
    expect(Object.keys(buildRegenerateBody('Motivo'))).toEqual(['rejection_reason']);
  });
});

describe('buildDiscardBody', () => {
  it('motivo vacio: body vacio, no manda rejection_reason', () => {
    expect(buildDiscardBody('')).toEqual({});
    expect(buildDiscardBody('   ')).toEqual({});
  });

  it('motivo presente: lo manda recortado', () => {
    expect(buildDiscardBody('  No corresponde  ')).toEqual({ rejection_reason: 'No corresponde' });
  });

  it('nunca incluye un campo de revisor: el revisor sale del token', () => {
    const body = buildDiscardBody('Motivo');
    expect(Object.keys(body)).toEqual(['rejection_reason']);
  });
});

describe('reviewActionErrorOutcome', () => {
  it('not-found y conflict refrescan la cola', () => {
    expect(reviewActionErrorOutcome('not-found')).toBe('refresh-queue');
    expect(reviewActionErrorOutcome('conflict')).toBe('refresh-queue');
  });

  it('bad-request, red, servidor y cualquier otro caso reabren', () => {
    expect(reviewActionErrorOutcome('bad-request')).toBe('reopen');
    expect(reviewActionErrorOutcome('network')).toBe('reopen');
    expect(reviewActionErrorOutcome('server')).toBe('reopen');
    expect(reviewActionErrorOutcome('unavailable')).toBe('reopen');
    expect(reviewActionErrorOutcome('validation')).toBe('reopen');
    expect(reviewActionErrorOutcome('forbidden')).toBe('reopen');
    expect(reviewActionErrorOutcome('unknown')).toBe('reopen');
  });
});

describe('reviewActionErrorMessage', () => {
  it('bad-request con detail: devuelve el detail tal cual', () => {
    expect(reviewActionErrorMessage('bad-request', 'El texto no puede superar los 5000 caracteres')).toBe(
      'El texto no puede superar los 5000 caracteres',
    );
  });

  it('bad-request sin detail: mensaje generico', () => {
    expect(reviewActionErrorMessage('bad-request', null)).toBe('No se pudo guardar. Intentá de nuevo.');
  });

  it('unavailable con detail: el detail y, en otra linea, verificar en Jira', () => {
    expect(reviewActionErrorMessage('unavailable', 'Todavía no se configuró la conexión con JSM')).toBe(
      `Todavía no se configuró la conexión con JSM\n${VERIFY_IN_JIRA_MESSAGE}`,
    );
  });

  it('cualquier otra categoria: mensaje generico, aunque venga un detail', () => {
    expect(reviewActionErrorMessage('network', null)).toBe('No se pudo guardar. Intentá de nuevo.');
    expect(reviewActionErrorMessage('server', 'algo que no deberia mostrarse')).toBe(
      'No se pudo guardar. Intentá de nuevo.',
    );
  });
});

describe('approveUnavailableMessage', () => {
  it('con detail: el detail tal cual y la linea fija de verificar en Jira', () => {
    const lines = approveUnavailableMessage('No se pudo aprobar la interaccion').split('\n');

    expect(lines).toEqual(['No se pudo aprobar la interaccion', VERIFY_IN_JIRA_MESSAGE]);
  });

  it('sin detail: mensaje de servicio no disponible y la misma linea fija', () => {
    const lines = approveUnavailableMessage(null).split('\n');

    expect(lines).toEqual(['El servicio no está disponible. Intentá de nuevo en unos minutos.', VERIFY_IN_JIRA_MESSAGE]);
  });

  it('la linea de verificar en Jira dice que no se reintenta a ciegas', () => {
    expect(VERIFY_IN_JIRA_MESSAGE).toBe('Antes de reintentar, verificá en el ticket de Jira si la respuesta ya se publicó.');
  });
});

describe('NOT_PENDING_MESSAGE', () => {
  it('es neutro: cubre que ya se resolvio o que la esta resolviendo otra persona', () => {
    expect(NOT_PENDING_MESSAGE).toBe(
      'Esta solicitud ya no está pendiente de revisión o la está resolviendo otra persona.',
    );
  });
});

describe('regenerateErrorResolution', () => {
  it('404 cierra el dialogo con not-found', () => {
    expect(regenerateErrorResolution('not-found', null)).toEqual({ kind: 'close', result: 'not-found' });
  });

  it('409 cierra el dialogo con not-pending', () => {
    expect(regenerateErrorResolution('conflict', null)).toEqual({ kind: 'close', result: 'not-pending' });
  });

  it('503 con detail: solo el detail, sin la linea de verificar en Jira', () => {
    const resolution = regenerateErrorResolution('unavailable', 'Todavía no se configuró la conexión con JSM');

    expect(resolution).toEqual({ kind: 'message', message: 'Todavía no se configuró la conexión con JSM' });
    expect(JSON.stringify(resolution)).not.toContain('Jira');
  });

  it('503 sin detail: mensaje de servicio no disponible', () => {
    expect(regenerateErrorResolution('unavailable', null)).toEqual({
      kind: 'message',
      message: 'El servicio no está disponible. Intentá de nuevo en unos minutos.',
    });
  });

  it('403 y 422 dejan el dialogo abierto con su mensaje', () => {
    expect(regenerateErrorResolution('forbidden', null)).toEqual({
      kind: 'message',
      message: 'No tenés permisos para regenerar esta respuesta.',
    });
    expect(regenerateErrorResolution('validation', null)).toEqual({
      kind: 'message',
      message: 'Revisá los datos ingresados.',
    });
  });

  it('red, servidor y otros casos: mensaje generico con el dialogo abierto, aunque venga un detail', () => {
    for (const category of ['network', 'server', 'bad-request', 'unknown'] as const) {
      expect(regenerateErrorResolution(category, 'no deberia mostrarse')).toEqual({
        kind: 'message',
        message: 'No se pudo regenerar la respuesta. Intentá de nuevo.',
      });
    }
  });
});
