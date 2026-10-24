import { HttpErrorResponse } from '@angular/common/http';
import { formSaveErrorMessage } from './form-error';

function httpError(status: number, body?: unknown): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: body });
}

const FALLBACK = 'Ocurrió un error inesperado. Intentá de nuevo.';

describe('formSaveErrorMessage', () => {
  it('400 con detail: el detail del backend tal cual', () => {
    const error = httpError(400, { detail: 'Hay más de un estado activo con la misma acción' });

    expect(formSaveErrorMessage(error, FALLBACK)).toBe('Hay más de un estado activo con la misma acción');
  });

  it('400 sin detail legible: el mensaje generico', () => {
    expect(formSaveErrorMessage(httpError(400, {}), FALLBACK)).toBe(FALLBACK);
    expect(formSaveErrorMessage(httpError(400, { detail: ['x'] }), FALLBACK)).toBe(FALLBACK);
  });

  it('503 con detail: el detail del backend, no el texto fijo del clasificador', () => {
    const error = httpError(503, { detail: 'No se pudo persistir la configuracion' });

    expect(formSaveErrorMessage(error, FALLBACK)).toBe('No se pudo persistir la configuracion');
  });

  it('503 sin detail: el texto fijo de servicio no disponible', () => {
    expect(formSaveErrorMessage(httpError(503), FALLBACK)).toBe(
      'El servicio no está disponible. Intentá de nuevo en unos minutos.',
    );
  });

  it('otros errores: el mensaje generico, aunque traigan un detail', () => {
    expect(formSaveErrorMessage(httpError(500, { detail: 'interno' }), FALLBACK)).toBe(FALLBACK);
    expect(formSaveErrorMessage(httpError(422, { detail: 'x' }), FALLBACK)).toBe(FALLBACK);
    expect(formSaveErrorMessage(new Error('sin red'), FALLBACK)).toBe(FALLBACK);
  });
});
