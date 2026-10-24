import { HttpErrorResponse } from '@angular/common/http';
import { RESPONSE_TIMES_ERROR_MESSAGE, responseTimesErrorMessage } from './response-times-error';

describe('responseTimesErrorMessage', () => {
  it('422 con detail de texto muestra ese texto', () => {
    const error = new HttpErrorResponse({ status: 422, error: { detail: 'El huso horario no es valido' } });

    expect(responseTimesErrorMessage(error)).toBe('El huso horario no es valido');
  });

  it('422 con detail como lista cae en el mensaje generico', () => {
    const error = new HttpErrorResponse({ status: 422, error: { detail: [{ loc: ['query', 'tz'], msg: 'x', type: 'y' }] } });

    expect(responseTimesErrorMessage(error)).toBe(RESPONSE_TIMES_ERROR_MESSAGE);
  });

  it('422 con detail vacio cae en el mensaje generico', () => {
    expect(responseTimesErrorMessage(new HttpErrorResponse({ status: 422, error: { detail: '  ' } }))).toBe(RESPONSE_TIMES_ERROR_MESSAGE);
  });

  it('422 sin cuerpo cae en el mensaje generico', () => {
    expect(responseTimesErrorMessage(new HttpErrorResponse({ status: 422 }))).toBe(RESPONSE_TIMES_ERROR_MESSAGE);
  });

  it('otros estados no muestran el detail aunque venga', () => {
    expect(responseTimesErrorMessage(new HttpErrorResponse({ status: 500, error: { detail: 'interno' } }))).toBe(
      RESPONSE_TIMES_ERROR_MESSAGE,
    );
  });

  it('un error que no es HTTP cae en el mensaje generico', () => {
    expect(responseTimesErrorMessage(new Error('x'))).toBe(RESPONSE_TIMES_ERROR_MESSAGE);
  });
});
