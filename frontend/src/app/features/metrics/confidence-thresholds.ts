import { ProjectThresholdsItem } from '../../api/models/project-thresholds-item';

export interface AgreedThresholds {
  thresholdAutoPublish: number | null;
  thresholdNeedsReview: number | null;
}

// Umbral comun a todos los proyectos, o null si no hay proyectos o si
// difieren entre si. No elige un proyecto "representativo": o coinciden
// todos, o no se devuelve ningun valor.
export function agreedThresholds(projects: ProjectThresholdsItem[]): AgreedThresholds {
  return {
    thresholdAutoPublish: valueIfAllAgree(projects, (project) => project.threshold_auto_publish),
    thresholdNeedsReview: valueIfAllAgree(projects, (project) => project.threshold_needs_review),
  };
}

function valueIfAllAgree(projects: ProjectThresholdsItem[], pick: (project: ProjectThresholdsItem) => number): number | null {
  if (projects.length === 0) return null;
  const first = pick(projects[0]);
  return projects.every((project) => pick(project) === first) ? first : null;
}
