import { INACTIVE_MARK, isProjectActive } from './project-activity';

describe('isProjectActive', () => {
  it('devuelve la marca del proyecto', () => {
    expect(isProjectActive({ is_active: true })).toBe(true);
    expect(isProjectActive({ is_active: false })).toBe(false);
  });

  it('sirve como predicado de filter y some', () => {
    const projects = [{ is_active: true }, { is_active: false }, { is_active: true }];

    expect(projects.filter(isProjectActive)).toHaveLength(2);
    expect(projects.some(isProjectActive)).toBe(true);
    expect([{ is_active: false }].some(isProjectActive)).toBe(false);
  });
});

describe('INACTIVE_MARK', () => {
  it('es "(inactivo)"', () => {
    expect(INACTIVE_MARK).toBe('(inactivo)');
  });
});
