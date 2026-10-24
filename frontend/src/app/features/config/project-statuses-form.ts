import { JsmStatus } from '../../api/models/jsm-status';
import { OnboardedProject } from '../../api/models/onboarded-project';
import { ProjectStatusMapping } from '../../api/models/project-status-mapping';
import { ProjectStatusMappingItem } from '../../api/models/project-status-mapping-item';
import { StatusActionItem } from '../../api/models/status-action-item';

// Reglas del pipeline sobre el vocabulario cerrado de acciones. Las opciones
// del selector siempre salen de la API: estos valores solo sirven para
// validar combinaciones, no para armar la lista. El pipeline toma un unico
// estado por proyecto para estas acciones, y con mas de uno activo usa
// cualquiera. La accion initial puede repetirse.
export const EXCLUSIVE_ACTIONS: readonly string[] = ['escalate', 'awaiting_customer', 'resolved'];
export const ESCALATE_ACTION = 'escalate';

export const DUPLICATE_ACTION_MESSAGE = 'Otro estado activo ya usa esta acción. Dejá solo uno.';
export const INVALID_ACTION_MESSAGE = 'Este valor ya no es válido. Elegí otra acción.';
export const NO_ESCALATE_WARNING =
  'Sin un estado con la acción de escalar, el sistema no mueve el ticket ni publica el acuse al escalar.';

export interface StatusMappingRow {
  // id interno de ticket_status, el que se manda como status_id
  statusId: string;
  name: string;
  // Accion con la que el estado queda efectivamente activo hoy. Un mapeo
  // guardado con is_active false cuenta como sin accion: el sistema lo
  // ignora, y elegirlo de nuevo lo reactiva al guardar.
  savedAction: string | null;
  action: string | null;
}

export interface StatusMappingValidation {
  // Mensaje por statusId de cada fila que bloquea el guardado
  rowErrors: Record<string, string>;
  // Avisos informativos, no bloquean
  warnings: string[];
}

// Solo salen filas de los estados que devuelve JSM: un mapeo guardado cuyo
// estado ya no existe queda afuera y no se reenvia.
export function buildStatusMappingRows(
  statuses: JsmStatus[],
  saved: ProjectStatusMappingItem[],
): StatusMappingRow[] {
  const savedByStatusId = new Map(saved.map((mapping) => [mapping.status_id, mapping]));

  return statuses.map((status) => {
    const mapping = savedByStatusId.get(status.status_id);
    const savedAction = mapping && mapping.is_active ? mapping.system_action : null;
    return { statusId: status.status_id, name: status.name, savedAction, action: savedAction };
  });
}

export function isRowModified(row: StatusMappingRow): boolean {
  return row.action !== row.savedAction;
}

export function statusMappingsHaveChanges(rows: StatusMappingRow[]): boolean {
  return rows.some(isRowModified);
}

export function validateStatusMappings(
  rows: StatusMappingRow[],
  actions: StatusActionItem[],
): StatusMappingValidation {
  const validValues = new Set(actions.map((action) => action.value));
  const rowErrors: Record<string, string> = {};

  for (const row of rows) {
    if (row.action !== null && !validValues.has(row.action)) {
      rowErrors[row.statusId] = INVALID_ACTION_MESSAGE;
    }
  }

  for (const exclusive of EXCLUSIVE_ACTIONS) {
    const holders = rows.filter((row) => row.action === exclusive);
    if (holders.length > 1) {
      for (const row of holders) {
        rowErrors[row.statusId] = DUPLICATE_ACTION_MESSAGE;
      }
    }
  }

  const warnings: string[] = [];
  const hasEscalate = rows.some((row) => row.action === ESCALATE_ACTION);
  if (rows.length > 0 && validValues.has(ESCALATE_ACTION) && !hasEscalate) {
    warnings.push(NO_ESCALATE_WARNING);
  }

  return { rowErrors, warnings };
}

export function canSaveStatusMappings(rows: StatusMappingRow[], validation: StatusMappingValidation): boolean {
  return statusMappingsHaveChanges(rows) && Object.keys(validation.rowErrors).length === 0;
}

// Upsert por fila: solo viajan las filas modificadas, siempre completas.
// Editar una fila es configurarla, por eso is_active va en true, y "Sin
// accion" se manda como null explicito.
export function buildStatusMappingsPayload(rows: StatusMappingRow[]): ProjectStatusMapping[] {
  return rows
    .filter(isRowModified)
    .map((row) => ({ status_id: row.statusId, system_action: row.action, is_active: true }));
}

// El POST exige los tres umbrales y pisa lo que no se envie, asi que
// siempre se reenvian los del ultimo estado guardado del proyecto.
export function thresholdsFromProject(
  project: OnboardedProject,
): Pick<OnboardedProject, 'threshold_auto_publish' | 'threshold_needs_review' | 'similarity_threshold'> {
  return {
    threshold_auto_publish: project.threshold_auto_publish,
    threshold_needs_review: project.threshold_needs_review,
    similarity_threshold: project.similarity_threshold,
  };
}
