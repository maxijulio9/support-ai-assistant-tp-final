import { ProjectThresholdsItem } from '../../api/models/project-thresholds-item';

// is_active se suma en los umbrales cuando se publique el contrato: hasta
// entonces es opcional, y un proyecto sin la marca cuenta como activo.
// Cuando el cliente generado lo incluya, este tipo se reemplaza por
// ProjectThresholdsItem.
export type ProjectThresholdsWithActivity = ProjectThresholdsItem & { is_active?: boolean };
