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
