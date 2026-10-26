import { isProjectActive } from '../../shared/project-activity';
import { ProjectThresholdsItem } from '../../api/models/project-thresholds-item';

export interface AgreedThresholds {
  thresholdAutoPublish: number | null;
  thresholdNeedsReview: number | null;
}

// Umbral comun a los proyectos, o null si no hay proyectos o si difieren
// entre si. No elige un proyecto "representativo": o coinciden todos, o no se
// devuelve ningun valor. Cuentan solo los proyectos activos, porque un
// inactivo no procesa tickets; si no hay ninguno activo se usan todos, para
// no dejar el histograma sin referencia.
export function agreedThresholds(projects: ProjectThresholdsItem[]): AgreedThresholds {
  const active = projects.filter(isProjectActive);
  const considered = active.length > 0 ? active : projects;

  return {
    thresholdAutoPublish: valueIfAllAgree(considered, (project) => project.threshold_auto_publish),
    thresholdNeedsReview: valueIfAllAgree(considered, (project) => project.threshold_needs_review),
  };
}

function valueIfAllAgree(
  projects: ProjectThresholdsItem[],
  pick: (project: ProjectThresholdsItem) => number,
): number | null {
  if (projects.length === 0) return null;
  const first = pick(projects[0]);
  return projects.every((project) => pick(project) === first) ? first : null;
}
