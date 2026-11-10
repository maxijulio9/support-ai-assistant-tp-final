import { respondedAtText } from './responded-at';

describe('respondedAtText', () => {
  const now = new Date(2026, 10, 9, 12, 0);

  it('con fecha la muestra en formato corto, sin importar la decision', () => {
    const value = new Date(2026, 9, 5, 21, 57).toISOString();
    expect(respondedAtText(value, 'AUTO_PUBLISH', now)).toBe('5 oct, 21:57');
    expect(respondedAtText(value, 'NEEDS_REVIEW', now)).toBe('5 oct, 21:57');
  });

  it('agrega el año si no es el actual', () => {
    expect(respondedAtText(new Date(2025, 9, 5, 21, 57).toISOString(), 'AUTO_PUBLISH', now)).toBe('5 oct 2025, 21:57');
  });

  it('sin fecha y pendiente de revision: todavia no se respondio', () => {
    expect(respondedAtText(null, 'NEEDS_REVIEW', now)).toBe('Todavía no se respondió al cliente');
  });

  it('sin fecha y en cualquier otra decision: no registrada', () => {
    expect(respondedAtText(null, 'AUTO_PUBLISH', now)).toBe('No registrada');
    expect(respondedAtText(null, 'DISCARDED', now)).toBe('No registrada');
    expect(respondedAtText(null, 'PUBLISH_FAILED', now)).toBe('No registrada');
    expect(respondedAtText(undefined, 'ESCALATE', now)).toBe('No registrada');
  });

  it('sin decision tampoco rompe', () => {
    expect(respondedAtText(null, null, now)).toBe('No registrada');
  });

  it('una fecha ilegible se trata como ausente', () => {
    expect(respondedAtText('no es una fecha', 'NEEDS_REVIEW', now)).toBe('Todavía no se respondió al cliente');
    expect(respondedAtText('', 'AUTO_PUBLISH', now)).toBe('No registrada');
  });
});
