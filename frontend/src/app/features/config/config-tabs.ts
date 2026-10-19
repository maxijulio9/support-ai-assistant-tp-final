// Orden real de las pestañas en el mat-tab-group de Configuracion. El query
// param ?tab= usa estas keys (no el indice), para que la URL no dependa del
// orden interno de las pestañas.
export const CONFIG_TAB_KEYS = ['jsm', 'proyectos', 'campos', 'confluence', 'indexacion'] as const;

export type ConfigTabKey = (typeof CONFIG_TAB_KEYS)[number];

// Un valor invalido o ausente cae siempre en la primera pestaña (JSM).
export function resolveConfigTabIndex(tabParam: string | null): number {
  const index = CONFIG_TAB_KEYS.indexOf(tabParam as ConfigTabKey);
  return index === -1 ? 0 : index;
}

export function configTabKeyForIndex(index: number): ConfigTabKey {
  return CONFIG_TAB_KEYS[index] ?? CONFIG_TAB_KEYS[0];
}
