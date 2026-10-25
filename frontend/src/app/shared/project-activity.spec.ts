import { INACTIVE_MARK, isProjectActive } from './project-activity';

describe('isProjectActive', () => {
  it('sin la marca cuenta como activo, y false como inactivo', () => {
    expect(isProjectActive({})).toBe(true);
    expect(isProjectActive({ is_active: true })).toBe(true);
    expect(isProjectActive({ is_active: false })).toBe(false);
  });
});

describe('INACTIVE_MARK', () => {
  it('es "(inactivo)"', () => {
    expect(INACTIVE_MARK).toBe('(inactivo)');
  });
});
