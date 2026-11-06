import { infoHintLabel } from './info-hint';

describe('infoHintLabel', () => {
  it('nombra de que cosa es la ayuda', () => {
    expect(infoHintLabel('Escalamiento')).toBe('Más información sobre Escalamiento');
  });
});
