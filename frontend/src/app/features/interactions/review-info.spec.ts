import { generatedAtText, isHumanResolved, reviewText } from './review-info';

const now = new Date(2026, 10, 9, 12, 0);
const date = new Date(2026, 9, 5, 21, 57).toISOString();

function input(overrides: Partial<Parameters<typeof reviewText>[0]> = {}) {
  return { decision: 'AUTO_PUBLISH', resolution_channel: 'AUTO', reviewed_at: null, reviewed_by_name: null, ...overrides };
}

describe('generatedAtText', () => {
  it('con fecha la muestra en formato corto', () => {
    expect(generatedAtText(date, now)).toBe('Respuesta sugerida generada el 5 oct, 21:57');
  });

  it('agrega el año si no es el actual', () => {
    expect(generatedAtText(new Date(2025, 9, 5, 21, 57).toISOString(), now)).toBe('Respuesta sugerida generada el 5 oct 2025, 21:57');
  });

  it('sin fecha o con una ilegible dice No registrada', () => {
    expect(generatedAtText(null, now)).toBe('Respuesta sugerida generada: No registrada');
    expect(generatedAtText(undefined, now)).toBe('Respuesta sugerida generada: No registrada');
    expect(generatedAtText('', now)).toBe('Respuesta sugerida generada: No registrada');
    expect(generatedAtText('no es una fecha', now)).toBe('Respuesta sugerida generada: No registrada');
  });
});

describe('isHumanResolved', () => {
  it('reconoce cada canal manual', () => {
    for (const channel of ['REVIEWED_APPROVED', 'REVIEWED_EDITED', 'REVIEWED_REGENERATED', 'ESCALATED_BY_HUMAN', 'DISCARDED_BY_HUMAN']) {
      expect(isHumanResolved({ decision: 'X', resolution_channel: channel })).toBe(true);
    }
  });

  it('una decision descartada es manual aunque no venga el canal', () => {
    expect(isHumanResolved({ decision: 'DISCARDED', resolution_channel: null })).toBe(true);
  });

  it('automatica, pendiente, externa y sin datos no son manuales', () => {
    expect(isHumanResolved({ decision: 'AUTO_PUBLISH', resolution_channel: 'AUTO' })).toBe(false);
    expect(isHumanResolved({ decision: 'NEEDS_REVIEW', resolution_channel: null })).toBe(false);
    expect(isHumanResolved({ decision: 'RESOLVED_EXTERNALLY', resolution_channel: 'RESOLVED_EXTERNALLY' })).toBe(false);
    expect(isHumanResolved({ decision: null, resolution_channel: null })).toBe(false);
  });
});

describe('reviewText', () => {
  it('con fecha y nombre', () => {
    expect(reviewText(input({ decision: 'AUTO_PUBLISH', resolution_channel: 'REVIEWED_APPROVED', reviewed_at: date, reviewed_by_name: 'Ana Pérez' }), now)).toBe(
      'Revisada el 5 oct, 21:57 por Ana Pérez',
    );
  });

  it('con fecha y sin nombre, o con nombre vacio', () => {
    const base = { resolution_channel: 'REVIEWED_EDITED', reviewed_at: date };
    expect(reviewText(input({ ...base, reviewed_by_name: null }), now)).toBe('Revisada el 5 oct, 21:57');
    expect(reviewText(input({ ...base, reviewed_by_name: '  ' }), now)).toBe('Revisada el 5 oct, 21:57');
  });

  it('resuelta por una persona sin fecha: revision no registrada, tenga o no nombre', () => {
    expect(reviewText(input({ resolution_channel: 'ESCALATED_BY_HUMAN', decision: 'ESCALATE' }), now)).toBe('Revisión no registrada');
    expect(reviewText(input({ resolution_channel: 'REVIEWED_APPROVED', reviewed_by_name: 'Ana' }), now)).toBe('Revisión no registrada');
    expect(reviewText(input({ resolution_channel: null, decision: 'DISCARDED' }), now)).toBe('Revisión no registrada');
  });

  it('publicacion automatica sin fecha: sin revision humana', () => {
    expect(reviewText(input(), now)).toBe('Sin revisión humana');
  });

  it('pendiente, cierre del cliente, externa y sin datos no muestran la linea', () => {
    expect(reviewText(input({ decision: 'NEEDS_REVIEW', resolution_channel: null }), now)).toBeNull();
    expect(reviewText(input({ decision: 'RESOLVED', resolution_channel: 'AUTO' }), now)).toBeNull();
    expect(reviewText(input({ decision: 'RESOLVED_EXTERNALLY', resolution_channel: 'RESOLVED_EXTERNALLY' }), now)).toBeNull();
    expect(reviewText(input({ decision: null, resolution_channel: null }), now)).toBeNull();
  });

  it('una fecha ilegible se trata como ausente', () => {
    expect(reviewText(input({ resolution_channel: 'REVIEWED_APPROVED', reviewed_at: 'basura' }), now)).toBe('Revisión no registrada');
  });
});
