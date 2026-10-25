// Marca de si un proyecto esta activo, compartida por Configuracion y Metricas.
export const INACTIVE_MARK = '(inactivo)';

// Un proyecto sin la marca (backend anterior al campo) cuenta como activo.
export function isProjectActive(project: { is_active?: boolean }): boolean {
  return project.is_active !== false;
}
