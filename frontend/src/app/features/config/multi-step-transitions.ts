import { HttpErrorResponse } from '@angular/common/http';
import { formSaveErrorMessage } from '../../shared/form-error';

export const MULTI_STEP_TITLE = 'Permitir que el sistema pase por un estado intermedio';

// Texto completo de la ayuda, en tres parrafos (solo cambia el corte visual,
// las palabras son las del texto original). Se muestra desplegable en la
// pantalla y entero en el dialogo de confirmacion.
export const MULTI_STEP_HELP_PARAGRAPHS: readonly string[] = [
  'Cuando el flujo de Jira no permite llevar el ticket directo al estado que el sistema necesita (por ejemplo, de Waiting for agent a Waiting for customer), el sistema puede pasar por un único estado intermedio, como Work in progress.',
  'Cada estado intermedio es un cambio real en Jira y puede disparar notificaciones, automatizaciones o relojes de SLA. Si el segundo paso falla, el ticket queda en el estado intermedio, donde el sistema deja de procesar los comentarios del cliente.',
  'La opción más segura es agregar en el flujo de Jira una transición desde cualquier estado hacia el estado que necesita el sistema.',
];

export const MULTI_STEP_DIALOG = { cancel: 'Cancelar', confirm: 'Permitir' };

export function multiStepDialogProjectLine(projectName: string): string {
  return `Proyecto: ${projectName}`;
}

// Ayuda corta, siempre visible: dice como esta la opcion y que cambia al moverla.
export function multiStepShortHelp(enabled: boolean): string {
  return enabled
    ? 'Encendida: cuando Jira no permite una transición directa, el sistema puede pasar por un único estado intermedio. Si la apagás, solo usa transiciones directas.'
    : 'Apagada: el sistema solo usa transiciones directas de Jira. Si la encendés, puede pasar por un único estado intermedio cuando no hay una directa.';
}

export function moreInfoLabel(expanded: boolean): string {
  return expanded ? 'Ocultar información' : 'Más información';
}

// Estado por proyecto de lo que esta pasando con la llave. desired es lo que
// se esta guardando (null si no hay un pedido en curso); locked bloquea la
// llave durante el pedido y un instante despues, para que un doble clic no
// dispare dos pedidos.
export interface MultiStepKeyState {
  desired: boolean | null;
  locked: boolean;
  error: string | null;
}

export const IDLE_MULTI_STEP_STATE: MultiStepKeyState = { desired: null, locked: false, error: null };

export interface MultiStepToggleState {
  checked: boolean;
  disabled: boolean;
}

// Mientras se guarda, la llave muestra el valor pedido (bloqueada); si el
// pedido falla, desired vuelve a null y muestra otra vez el valor guardado.
export function multiStepToggleState(saved: boolean, state: MultiStepKeyState): MultiStepToggleState {
  return { checked: state.desired ?? saved, disabled: state.locked };
}

export type MultiStepAction = 'ask-confirmation' | 'save' | 'none';

// Solo encender pide confirmacion: apagar vuelve al comportamiento seguro.
export function multiStepActionFor(current: boolean, desired: boolean): MultiStepAction {
  if (current === desired) return 'none';
  return desired ? 'ask-confirmation' : 'save';
}

export function multiStepSnackbarMessage(enabled: boolean, projectName: string): string {
  return enabled
    ? `${projectName}: el sistema ahora puede pasar por un estado intermedio.`
    : `${projectName}: el sistema ya no pasa por estados intermedios.`;
}

const FORBIDDEN_MESSAGE = 'No tenés permiso para cambiar esta opción. Solo lo puede hacer un administrador.';
const GENERIC_MESSAGE = 'No se pudo cambiar la opción. Intentá de nuevo.';

// 403 por codigo, el detail del backend en 400 y 503 (y en los demas codigos
// con detail de formSaveErrorMessage), y un texto fijo para el resto.
export function multiStepErrorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse && error.status === 403) return FORBIDDEN_MESSAGE;
  return formSaveErrorMessage(error, GENERIC_MESSAGE);
}
