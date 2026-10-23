import {
  CATEGORY_SAVE_BLOCKED_MESSAGE,
  categoriesHaveChanges,
  categoriesOutsideFieldMessage,
  categoriesOutsideOptions,
  categorySaveBlockedReason,
  categorySaveSuccessMessage,
  mergedActiveCategories,
} from './project-categories-form';

describe('categoriesOutsideOptions', () => {
  it('ninguna activa queda afuera de las opciones del campo', () => {
    expect(categoriesOutsideOptions(['Bug', 'Hardware'], ['Bug', 'Hardware', 'Feature'])).toEqual([]);
  });

  it('alguna activa no pertenece a las opciones del campo', () => {
    expect(categoriesOutsideOptions(['Bug', 'Soporte'], ['Bug', 'Hardware'])).toEqual(['Soporte']);
  });

  it('todas las activas quedan afuera de las opciones del campo', () => {
    expect(categoriesOutsideOptions(['Soporte', 'Legal'], ['Bug', 'Hardware'])).toEqual(['Soporte', 'Legal']);
  });
});

describe('mergedActiveCategories', () => {
  it('une lo tildado en el campo con lo preservado', () => {
    expect(mergedActiveCategories(['Bug'], ['Soporte'])).toEqual(['Bug', 'Soporte']);
  });

  it('sin preservadas, devuelve solo lo tildado en el campo', () => {
    expect(mergedActiveCategories(['Bug', 'Hardware'], [])).toEqual(['Bug', 'Hardware']);
  });

  it('un nombre preservado que coincide con uno tildado no se duplica', () => {
    expect(mergedActiveCategories(['Bug', 'Soporte'], ['Soporte'])).toEqual(['Bug', 'Soporte']);
  });
});

describe('categoriesHaveChanges', () => {
  it('false cuando el pendiente es igual al guardado', () => {
    expect(categoriesHaveChanges(new Set(['Bug', 'Hardware']), new Set(['Hardware', 'Bug']))).toBe(false);
  });

  it('true cuando se agrego una categoria', () => {
    expect(categoriesHaveChanges(new Set(['Bug', 'Hardware']), new Set(['Bug']))).toBe(true);
  });

  it('true cuando se quito una categoria', () => {
    expect(categoriesHaveChanges(new Set(['Bug']), new Set(['Bug', 'Hardware']))).toBe(true);
  });

  it('true cuando cambia el contenido aunque el tamaño sea igual', () => {
    expect(categoriesHaveChanges(new Set(['Bug', 'Soporte']), new Set(['Bug', 'Hardware']))).toBe(true);
  });
});

describe('categorySaveBlockedReason', () => {
  it('devuelve el mensaje del backend cuando el pendiente queda vacio', () => {
    expect(categorySaveBlockedReason(new Set())).toBe(CATEGORY_SAVE_BLOCKED_MESSAGE);
  });

  it('null cuando queda al menos una categoria pendiente', () => {
    expect(categorySaveBlockedReason(new Set(['Bug']))).toBeNull();
  });
});

describe('categorySaveSuccessMessage', () => {
  it('sin desactivadas: mensaje simple', () => {
    expect(categorySaveSuccessMessage(0)).toBe('Categorías guardadas');
  });

  it('una desactivada: singular', () => {
    expect(categorySaveSuccessMessage(1)).toBe('Categorías guardadas. 1 categoría desactivada.');
  });

  it('varias desactivadas: plural', () => {
    expect(categorySaveSuccessMessage(3)).toBe('Categorías guardadas. 3 categorías desactivadas.');
  });
});

describe('categoriesOutsideFieldMessage', () => {
  it('null cuando no hay ninguna afuera', () => {
    expect(categoriesOutsideFieldMessage(0)).toBeNull();
  });

  it('una afuera: singular', () => {
    expect(categoriesOutsideFieldMessage(1)).toBe(
      '1 categoría activa guardada no pertenece a este campo y se conserva al guardar.',
    );
  });

  it('varias afuera: plural', () => {
    expect(categoriesOutsideFieldMessage(2)).toBe(
      '2 categorías activas guardadas no pertenecen a este campo y se conservan al guardar.',
    );
  });
});
