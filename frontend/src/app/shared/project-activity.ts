// Marca de si un proyecto esta activo, compartida por Configuracion y Metricas.
export const INACTIVE_MARK = '(inactivo)';

export function isProjectActive(project: { is_active: boolean }): boolean {
  return project.is_active;
}
