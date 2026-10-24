import { HttpErrorResponse } from '@angular/common/http';

export const RESPONSE_TIMES_ERROR_MESSAGE = 'No se pudieron cargar los tiempos de respuesta. Intentá de nuevo.';
export const RESPONSE_TIMES_UNAVAILABLE_MESSAGE = 'Los tiempos de respuesta todavía no están disponibles.';

// Error local mientras el cliente generado no incluye el endpoint: no hay
// llamada HTTP posible, y no es un fallo que reintentar.
export class ResponseTimesUnavailableError extends Error {
  constructor() {
    super(RESPONSE_TIMES_UNAVAILABLE_MESSAGE);
    this.name = 'ResponseTimesUnavailableError';
  }
}

// El 422 trae el motivo en detail como texto (huso, fechas o proyecto
// invalidos). Si detail no es un texto legible, por ejemplo la lista del 422
// automatico del framework, se usa el mensaje generico en lugar de mostrarla.
export function responseTimesErrorMessage(error: unknown): string {
  if (error instanceof ResponseTimesUnavailableError) return RESPONSE_TIMES_UNAVAILABLE_MESSAGE;
  if (error instanceof HttpErrorResponse && error.status === 422) {
    const detail = error.error?.detail;
    if (typeof detail === 'string' && detail.trim().length > 0) return detail.trim();
  }
  return RESPONSE_TIMES_ERROR_MESSAGE;
}
