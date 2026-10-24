import { OnboardedProject } from '../../../api/models/onboarded-project';

export interface ProjectOption {
  projectId: string;
  label: string;
}

export type OnboardedProjectLabelSource = Pick<OnboardedProject, 'project_id' | 'key' | 'name'>;

const SHORT_ID_LENGTH = 8;

function fallbackLabel(projectId: string): string {
  return `Proyecto ${projectId.slice(0, SHORT_ID_LENGTH)}`;
}

// Arma los rotulos del selector. Los ids salen de los umbrales, que no traen
// el nombre, y los nombres de la lista de proyectos configurados, que puede
// no estar disponible (por ejemplo, un 403 para un usuario sin rol de
// administrador): en ese caso, o si el proyecto no figura, se usa un rotulo
// corto con el id. Cuando los umbrales incluyan el nombre, se reemplaza solo
// esta funcion.
export function buildProjectOptions(projectIds: string[], onboarded: OnboardedProjectLabelSource[] | null): ProjectOption[] {
  const byId = new Map((onboarded ?? []).map((project) => [project.project_id, project]));

  return projectIds.map((projectId) => {
    const project = byId.get(projectId);
    const name = project?.name.trim() ?? '';
    const key = project?.key.trim() ?? '';

    if (name && key) return { projectId, label: `${name} (${key})` };
    if (name || key) return { projectId, label: name || key };
    return { projectId, label: fallbackLabel(projectId) };
  });
}
