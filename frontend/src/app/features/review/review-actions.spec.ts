import {
  MAX_EDITED_RESPONSE_LENGTH,
  buildApproveBody,
  buildDiscardBody,
  isEditedResponseValid,
  normalizeResponseText,
  resolveEditedResponse,
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
  it('sin reviewedBy y sin edicion: body vacio (igual que hoy)', () => {
    expect(buildApproveBody(undefined, null)).toEqual({});
  });

  it('con reviewedBy y sin edicion: solo reviewed_by (mismo comportamiento de hoy)', () => {
    expect(buildApproveBody('uuid-123', null)).toEqual({ reviewed_by: 'uuid-123' });
  });

  it('sin reviewedBy y con edicion: solo edited_response', () => {
    expect(buildApproveBody(undefined, 'Texto editado')).toEqual({ edited_response: 'Texto editado' });
  });

  it('con reviewedBy y con edicion: ambos campos', () => {
    expect(buildApproveBody('uuid-123', 'Texto editado')).toEqual({
      reviewed_by: 'uuid-123',
      edited_response: 'Texto editado',
    });
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
