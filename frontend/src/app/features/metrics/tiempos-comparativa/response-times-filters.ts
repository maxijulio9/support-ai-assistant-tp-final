// Valor explicito de ?project= para "Todos los proyectos". La ausencia del
// parametro no significa "todos": significa "el primero".
export const ALL_PROJECTS = 'all';

export interface ResponseTimesFilters {
  // null: sin filtro de proyecto, sin objetivo ni porcentaje dentro del objetivo
  projectId: string | null;
  category: string | null;
}

// Resuelve el valor del selector contra los proyectos disponibles. Sin param,
// o con un id que ya no esta en la lista, cae en el primer proyecto. Sin
// proyectos no hay nada que elegir y queda "Todos".
export function resolveProjectSelection(param: string | null, projectIds: string[]): string {
  if (projectIds.length === 0) return ALL_PROJECTS;
  if (param === ALL_PROJECTS) return ALL_PROJECTS;
  if (param !== null && projectIds.includes(param)) return param;
  return projectIds[0];
}

export function buildResponseTimesFilters(selection: string, category: string | null): ResponseTimesFilters {
  return { projectId: selection === ALL_PROJECTS ? null : selection, category };
}
