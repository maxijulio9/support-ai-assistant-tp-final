import { INACTIVE_MARK, isProjectActive } from '../../../shared/project-activity';
import { ProjectThresholdsWithActivity } from '../project-thresholds-activity';

export interface ProjectOption {
  projectId: string;
  label: string;
}

export type ProjectLabelSource = Pick<ProjectThresholdsWithActivity, 'project_id' | 'key' | 'name' | 'is_active'>;

// "Nombre (CLAVE)", y para un inactivo "Nombre (inactivo) (CLAVE)".
function labelOf(project: ProjectLabelSource): string {
  const name = project.name.trim();
  const key = project.key.trim();
  const named = isProjectActive(project) || !name ? name : `${name} ${INACTIVE_MARK}`;

  if (name && key) return `${named} (${key})`;
  if (name) return named;
  return isProjectActive(project) ? key : `${key} ${INACTIVE_MARK}`;
}

const collator = (a: string, b: string) => a.localeCompare(b, 'es', { sensitivity: 'base' });

// Opciones del selector de proyecto: los activos primero y los inactivos al
// final, y dentro de cada grupo por nombre del lado del cliente (sin
// distinguir mayusculas ni acentos, y por clave si empatan).
export function buildProjectOptions(projects: ProjectLabelSource[]): ProjectOption[] {
  return [...projects]
    .sort(
      (a, b) =>
        Number(!isProjectActive(a)) - Number(!isProjectActive(b)) || collator(a.name, b.name) || collator(a.key, b.key),
    )
    .map((project) => ({ projectId: project.project_id, label: labelOf(project) }));
}
