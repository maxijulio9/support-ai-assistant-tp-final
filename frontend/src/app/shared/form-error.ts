import { HttpErrorResponse } from '@angular/common/http';

export type FormErrorCategory = 'validation-message' | 'service-unavailable' | 'unknown';

export interface FormErrorResult {
  category: FormErrorCategory;
  message: string | null;
}

const SERVICE_UNAVAILABLE_MESSAGE = 'El servicio no está disponible. Intentá de nuevo en unos minutos.';

// Clasificador compartido para los formularios que no son login ni revision
// (Olvidé/Restablecer contraseña, Perfil, Usuarios, Configuración): esas dos
// pantallas ya tienen su propio clasificador (auth-errors.ts, review-errors.ts),
// pensado para lo que cada una necesita distinguir en particular. Este es
// para el resto, con un criterio uniforme: 400/404/409 muestran el detail
// que manda el backend, 503 un mensaje fijo, y el resto (incluido un 422 que
// no deberia ocurrir si el formulario valida bien) cae en generico.
export function classifyFormError(error: unknown): FormErrorResult {
  if (!(error instanceof HttpErrorResponse)) {
    return { category: 'unknown', message: null };
  }

  if (error.status === 400 || error.status === 404 || error.status === 409) {
    const detail = typeof error.error?.detail === 'string' ? error.error.detail : null;
    return { category: 'validation-message', message: detail };
  }

  if (error.status === 503) {
    return { category: 'service-unavailable', message: SERVICE_UNAVAILABLE_MESSAGE };
  }

  return { category: 'unknown', message: null };
}

// Mensaje para un guardado fallido: el detail del backend tal cual en un
// 400, 404 o 409 y tambien en un 503, donde classifyFormError usa un texto
// fijo pero el backend explica el motivo (por ejemplo que no se pudo
// persistir). Si no hay detail legible, el mensaje fijo del 503 o el
// generico que pasa quien llama.
export function formSaveErrorMessage(error: unknown, fallback: string): string {
  const result = classifyFormError(error);
  if (result.category === 'validation-message') return result.message ?? fallback;
  if (result.category === 'service-unavailable') {
    const detail = error instanceof HttpErrorResponse && typeof error.error?.detail === 'string' ? error.error.detail : null;
    return detail ?? result.message ?? fallback;
  }
  return fallback;
}
