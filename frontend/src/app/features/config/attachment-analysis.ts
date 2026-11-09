import { HttpErrorResponse } from '@angular/common/http';
import { formSaveErrorMessage } from '../../shared/form-error';

export const ATTACHMENT_ANALYSIS_TITLE = 'Analizar imágenes adjuntas';

export const ATTACHMENT_ANALYSIS_INTRO =
  'Es una opción y viene apagada. Si la encendés, el sistema lee las imágenes de los tickets nuevos y usa lo que ve para entender mejor el problema y responder.';

export interface AttachmentAnalysisSection {
  title: string;
  items: readonly string[];
}

// Contenido del dialogo de confirmacion, en secciones con lista: a donde van
// las imagenes y el riesgo de datos sensibles, que se analiza, y que conviene
// tener en cuenta antes de encenderla.
export const ATTACHMENT_ANALYSIS_SECTIONS: readonly AttachmentAnalysisSection[] = [
  {
    title: 'Qué pasa con las imágenes',
    items: [
      'Se envían al proveedor del modelo configurado para que las describa.',
      'Pueden mostrar datos personales o financieros. Encendela solo si el proveedor está autorizado a recibirlos.',
      'La imagen no se guarda: solo su descripción queda en el registro de la interacción.',
    ],
  },
  {
    title: 'Qué se analiza',
    items: [
      'Solo archivos PNG o JPG, hasta 3 imágenes de 5 MB por ticket. Los otros archivos se ignoran.',
      'Solo los tickets nuevos. Las imágenes que llegan en comentarios posteriores no se leen.',
      'Si una imagen no se puede leer o no aporta información, el sistema responde con el texto del ticket.',
    ],
  },
  {
    title: 'Qué tener en cuenta antes de encenderla',
    items: [
      'Cada ticket nuevo con imágenes suma una consulta extra al modelo, así que la primera respuesta puede tardar algunos segundos más.',
      'Aumenta el consumo de tokens y el costo del proveedor, en proporción a la cantidad de imágenes.',
      'La descripción la genera el modelo, así que puede ser imprecisa. Conviene revisar las respuestas de los primeros tickets.',
      'Se aplica a los tickets que lleguen desde que la encendés. Podés apagarla cuando quieras.',
    ],
  },
];

export const ATTACHMENT_ANALYSIS_DIALOG = { cancel: 'Cancelar', confirm: 'Activar' };

// Nombre accesible de la llave de cada fila
export function attachmentAnalysisToggleLabel(projectName: string): string {
  return `Analizar imágenes adjuntas de ${projectName}`;
}

export function attachmentAnalysisDialogProjectLine(projectName: string): string {
  return `Proyecto: ${projectName}`;
}

// Estado de la llave de una fila. desired es lo que se esta guardando (null
// si no hay un pedido en curso); locked bloquea la llave durante el pedido y
// un instante despues, para que un doble clic no dispare dos pedidos.
export interface AttachmentAnalysisKeyState {
  desired: boolean | null;
  locked: boolean;
}

export const IDLE_ATTACHMENT_ANALYSIS_STATE: AttachmentAnalysisKeyState = { desired: null, locked: false };

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
