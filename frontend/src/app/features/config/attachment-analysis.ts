import { HttpErrorResponse } from '@angular/common/http';
import { formSaveErrorMessage } from '../../shared/form-error';

export const ATTACHMENT_ANALYSIS_TITLE = 'Analizar imágenes adjuntas';

// Texto permanente bajo el interruptor y, entero, en el dialogo de
// confirmacion: dice que es opcional, a donde van las imagenes, el riesgo de datos
// sensibles, que se lee y que se guarda.
export const ATTACHMENT_ANALYSIS_PARAGRAPHS: readonly string[] = [
  'Es una opción y viene apagada.',
  'Si la encendés, las imágenes de los tickets nuevos se envían al proveedor del modelo configurado para describirlas.',
  'Las imágenes pueden mostrar datos personales o financieros. Encendela solo si el proveedor del modelo está autorizado a recibirlos.',
  'Solo se leen archivos PNG o JPG, hasta 3 imágenes de 5 MB por ticket. Los otros archivos se ignoran.',
  'La imagen no se guarda: solo su descripción queda en el registro de la interacción.',
];

export const ATTACHMENT_ANALYSIS_DIALOG = { cancel: 'Cancelar', confirm: 'Encender' };

export function attachmentAnalysisDialogProjectLine(projectName: string): string {
  return `Proyecto: ${projectName}`;
}

// Estado por proyecto de lo que esta pasando con la llave. desired es lo que
// se esta guardando (null si no hay un pedido en curso); locked bloquea la
// llave durante el pedido y un instante despues, para que un doble clic no
// dispare dos pedidos.
export interface AttachmentAnalysisKeyState {
  desired: boolean | null;
  locked: boolean;
  error: string | null;
}

export const IDLE_ATTACHMENT_ANALYSIS_STATE: AttachmentAnalysisKeyState = { desired: null, locked: false, error: null };

export interface AttachmentAnalysisToggleState {
  checked: boolean;
  disabled: boolean;
}

// Mientras se guarda, la llave muestra el valor pedido (bloqueada); si el
// pedido falla, desired vuelve a null y muestra otra vez el valor guardado.
export function attachmentAnalysisToggleState(
  saved: boolean,
  state: AttachmentAnalysisKeyState,
): AttachmentAnalysisToggleState {
  return { checked: state.desired ?? saved, disabled: state.locked };
}

export type AttachmentAnalysisAction = 'ask-confirmation' | 'save' | 'none';

// Solo encender pide confirmacion: apagar deja de enviar imagenes al proveedor.
export function attachmentAnalysisActionFor(current: boolean, desired: boolean): AttachmentAnalysisAction {
  if (current === desired) return 'none';
  return desired ? 'ask-confirmation' : 'save';
}

export function attachmentAnalysisSnackbarMessage(enabled: boolean, projectName: string): string {
  return enabled
    ? `${projectName}: el sistema ahora analiza las imágenes adjuntas de los tickets nuevos.`
    : `${projectName}: el sistema ya no analiza las imágenes adjuntas.`;
}

const FORBIDDEN_MESSAGE = 'No tenés permiso para cambiar esta opción. Solo lo puede hacer un administrador.';
const GENERIC_MESSAGE = 'No se pudo cambiar la opción. Intentá de nuevo.';

// 403 por codigo, el detail del backend en 400 y 503 (y en los demas codigos
// con detail de formSaveErrorMessage), y un texto fijo para el resto.
export function attachmentAnalysisErrorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse && error.status === 403) return FORBIDDEN_MESSAGE;
  return formSaveErrorMessage(error, GENERIC_MESSAGE);
}
