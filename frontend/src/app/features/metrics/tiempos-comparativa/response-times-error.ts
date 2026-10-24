import { HttpErrorResponse } from '@angular/common/http';

export const RESPONSE_TIMES_ERROR_MESSAGE = 'No se pudieron cargar los tiempos de respuesta. Intentá de nuevo.';

// El 422 trae el motivo en detail como texto (huso, fechas o proyecto
// invalidos). Si detail no es un texto legible, por ejemplo la lista del 422
// automatico del framework, se usa el mensaje generico en lugar de mostrarla.
export function responseTimesErrorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse && error.status === 422) {
    const detail = error.error?.detail;
    if (typeof detail === 'string' && detail.trim().length > 0) return detail.trim();
  }
  return RESPONSE_TIMES_ERROR_MESSAGE;
}
