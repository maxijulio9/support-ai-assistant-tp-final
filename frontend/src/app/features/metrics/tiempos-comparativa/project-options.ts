import { ProjectThresholdsItem } from '../../../api/models/project-thresholds-item';

export interface ProjectOption {
  projectId: string;
  label: string;
}

export type ProjectLabelSource = Pick<ProjectThresholdsItem, 'project_id' | 'key' | 'name'>;

function labelOf(project: ProjectLabelSource): string {
  const name = project.name.trim();
  const key = project.key.trim();
  if (name && key) return `${name} (${key})`;
  return name || key;
}

// Opciones del selector de proyecto, ordenadas por nombre del lado del
// cliente (sin distinguir mayusculas ni acentos, y por clave si empatan).
export function buildProjectOptions(projects: ProjectLabelSource[]): ProjectOption[] {
  return [...projects]
    .sort(
      (a, b) =>
        a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }) || a.key.localeCompare(b.key, 'es', { sensitivity: 'base' }),
    )
    .map((project) => ({ projectId: project.project_id, label: labelOf(project) }));
}
