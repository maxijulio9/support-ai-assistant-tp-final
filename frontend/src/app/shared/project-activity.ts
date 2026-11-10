// Marca de si un proyecto esta activo, compartida por Configuracion y Metricas.
export const INACTIVE_MARK = '(inactivo)';

export function isProjectActive(project: { is_active: boolean }): boolean {
  return project.is_active;
}

// Un proyecto inactivo se puede consultar pero no editar: hay que activarlo
// primero. Regla unica de Configuracion para umbrales, analisis de imagenes,
// estados, transiciones, categorias, tipos de solicitud, prioridades y
// espacios. Sin proyecto (todavia no cargo) no se habilita nada.
export function isProjectEditable(project: { is_active: boolean } | null | undefined): boolean {
  return !!project && isProjectActive(project);
}

export const INACTIVE_PROJECT_NOTICE = 'El proyecto está inactivo. Activalo para editar su configuración.';
export const ACTIVATE_TO_EDIT_HINT = 'Activá el proyecto para editarlo';

// Motivo por el que un control esta bloqueado, para el tooltip; null si se puede editar
export function editBlockedHint(project: { is_active: boolean } | null | undefined): string | null {
  return isProjectEditable(project) ? null : ACTIVATE_TO_EDIT_HINT;
}
