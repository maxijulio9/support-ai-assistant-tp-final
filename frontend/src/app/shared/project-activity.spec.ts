import { ACTIVATE_TO_EDIT_HINT, INACTIVE_MARK, INACTIVE_PROJECT_NOTICE, editBlockedHint, isProjectActive, isProjectEditable } from './project-activity';

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

describe('isProjectEditable', () => {
  it('un proyecto activo se puede editar y uno inactivo no', () => {
    expect(isProjectEditable({ is_active: true })).toBe(true);
    expect(isProjectEditable({ is_active: false })).toBe(false);
  });

  it('sin proyecto no se habilita nada', () => {
    expect(isProjectEditable(null)).toBe(false);
    expect(isProjectEditable(undefined)).toBe(false);
  });

  it('al activar el proyecto vuelve a poder editarse', () => {
    const project = { is_active: false };
    expect(isProjectEditable(project)).toBe(false);
    expect(isProjectEditable({ ...project, is_active: true })).toBe(true);
  });
});

describe('editBlockedHint', () => {
  it('explica por que esta bloqueado y es null si se puede editar', () => {
    expect(editBlockedHint({ is_active: false })).toBe('Activá el proyecto para editarlo');
    expect(editBlockedHint(null)).toBe('Activá el proyecto para editarlo');
    expect(editBlockedHint({ is_active: true })).toBeNull();
  });

  it('el aviso general sin em dash', () => {
    expect(INACTIVE_PROJECT_NOTICE).toBe('El proyecto está inactivo. Activalo para editar su configuración.');
    expect(`${INACTIVE_PROJECT_NOTICE}${ACTIVATE_TO_EDIT_HINT}`).not.toMatch(/—/);
  });
});
