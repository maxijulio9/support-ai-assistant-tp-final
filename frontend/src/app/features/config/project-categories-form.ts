// Logica pura de Campos y categorias: el backend trata la lista del POST
// como el conjunto activo completo, pero la pantalla solo muestra las
// opciones del campo de JSM elegido en cada momento. Estas funciones
// separan lo que esta tildado en el campo visible de lo que queda
// preservado (categorias activas que no pertenecen a ese campo), para que
// el envio nunca pierda una categoria que el admin no llego a ver.

export function categoriesOutsideOptions(activeNames: Iterable<string>, fieldOptions: readonly string[]): string[] {
  const options = new Set(fieldOptions);
  return [...activeNames].filter((name) => !options.has(name));
}

// Union sin duplicados: en la practica checkedInField y preserved ya son
// disjuntos (preserved se define como lo que no esta en las opciones del
// campo), pero se dedupe igual por si alguna vez dejan de serlo.
export function mergedActiveCategories(checkedInField: readonly string[], preserved: readonly string[]): string[] {
  return [...new Set([...checkedInField, ...preserved])];
}

export function categoriesHaveChanges(pending: ReadonlySet<string>, saved: ReadonlySet<string>): boolean {
  if (pending.size !== saved.size) return true;
  for (const name of pending) {
    if (!saved.has(name)) return true;
  }
  return false;
}

// Mismo texto que devuelve el backend para este caso (ver
// ConfigureCategoriesRequest), para no inventar una redaccion distinta.
export const CATEGORY_SAVE_BLOCKED_MESSAGE = 'Hay que indicar al menos una categoría';

export function categorySaveBlockedReason(pending: ReadonlySet<string>): string | null {
  return pending.size === 0 ? CATEGORY_SAVE_BLOCKED_MESSAGE : null;
}

export function categorySaveSuccessMessage(categoriesDeactivated: number): string {
  if (categoriesDeactivated === 0) return 'Categorías guardadas';
  if (categoriesDeactivated === 1) return 'Categorías guardadas. 1 categoría desactivada.';
  return `Categorías guardadas. ${categoriesDeactivated} categorías desactivadas.`;
}

export function categoriesOutsideFieldMessage(count: number): string | null {
  if (count === 0) return null;
  if (count === 1) return '1 categoría activa guardada no pertenece a este campo y se conserva al guardar.';
  return `${count} categorías activas guardadas no pertenecen a este campo y se conservan al guardar.`;
}
