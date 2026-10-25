import { HttpErrorResponse } from '@angular/common/http';
import { formSaveErrorMessage } from '../../shared/form-error';
import { INACTIVE_MARK, isProjectActive } from '../../shared/project-activity';

export type ActivationKind = 'deactivate' | 'activate';

export interface ActivationAction {
  kind: ActivationKind;
  // Nunca "Eliminar": desactivar no borra nada
  label: string;
  // Solo desactivar pide confirmacion
  needsConfirmation: boolean;
}

export function activationAction(project: { is_active: boolean }): ActivationAction {
  return project.is_active
    ? { kind: 'deactivate', label: 'Desactivar', needsConfirmation: true }
    : { kind: 'activate', label: 'Activar', needsConfirmation: false };
}

// Rotulo de los selectores de proyecto de Configuracion: "CLAVE - Nombre", y
// "(inactivo)" justo despues del nombre cuando corresponde.
export function configProjectLabel(project: { key: string; name: string; is_active?: boolean }): string {
  const base = `${project.key} - ${project.name}`;
  return isProjectActive(project) ? base : `${base} ${INACTIVE_MARK}`;
}

function reviewsPendingText(count: number): string {
  return count === 1 ? 'Queda 1 revisión pendiente.' : `Quedan ${count} revisiones pendientes.`;
}

// Mensaje del snackbar despues de activar o desactivar. Al desactivar avisa
// cuantas revisiones pendientes quedan, y con 0 (o un valor que no sirve) no
// dice nada de eso.
export function activationSnackbarMessage(kind: ActivationKind, projectName: string, pendingReviews: number): string {
  if (kind === 'activate') return `${projectName} activado.`;

  const pending = Number.isFinite(pendingReviews) && pendingReviews > 0 ? Math.floor(pendingReviews) : 0;
  return pending > 0 ? `${projectName} desactivado. ${reviewsPendingText(pending)}` : `${projectName} desactivado.`;
}

const FORBIDDEN_MESSAGES: Record<ActivationKind, string> = {
  deactivate: 'No tenés permiso para desactivar proyectos. Solo lo puede hacer un administrador.',
  activate: 'No tenés permiso para activar proyectos. Solo lo puede hacer un administrador.',
};

const GENERIC_MESSAGES: Record<ActivationKind, string> = {
  deactivate: 'No se pudo desactivar el proyecto. Intentá de nuevo.',
  activate: 'No se pudo activar el proyecto. Intentá de nuevo.',
};

// 403 por codigo de estado, el detail del backend en 400 y 503 (y los demas
// codigos con detail de formSaveErrorMessage), y un texto fijo para el resto.
export function activationErrorMessage(error: unknown, kind: ActivationKind): string {
  if (error instanceof HttpErrorResponse && error.status === 403) return FORBIDDEN_MESSAGES[kind];
  return formSaveErrorMessage(error, GENERIC_MESSAGES[kind]);
}

export const DEACTIVATE_DIALOG = {
  cancel: 'Cancelar',
  confirm: 'Desactivar',
  body:
    'No se borra nada. Mientras el proyecto esté inactivo, el sistema ignora sus tickets nuevos y sus comentarios nuevos. ' +
    'Las revisiones pendientes siguen disponibles. Podés volver a activarlo cuando quieras.',
};

export function deactivateDialogTitle(projectName: string): string {
  return `Desactivar ${projectName}`;
}
