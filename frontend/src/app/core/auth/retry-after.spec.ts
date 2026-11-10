import { formatRetryAfter, parseRetryAfterSeconds } from './retry-after';

describe('parseRetryAfterSeconds', () => {
  it('lee un numero de segundos', () => {
    expect(parseRetryAfterSeconds('900')).toBe(900);
    expect(parseRetryAfterSeconds(' 61 ')).toBe(61);
  });

  it('devuelve null si el encabezado falta', () => {
    expect(parseRetryAfterSeconds(null)).toBeNull();
    expect(parseRetryAfterSeconds(undefined)).toBeNull();
    expect(parseRetryAfterSeconds('')).toBeNull();
  });

  it('devuelve null si no es numerico, incluida una fecha HTTP', () => {
    expect(parseRetryAfterSeconds('pronto')).toBeNull();
    expect(parseRetryAfterSeconds('Wed, 21 Oct 2026 07:28:00 GMT')).toBeNull();
    expect(parseRetryAfterSeconds('12abc')).toBeNull();
  });

  it('devuelve null con cero o negativo', () => {
    expect(parseRetryAfterSeconds('0')).toBeNull();
    expect(parseRetryAfterSeconds('-30')).toBeNull();
  });
});

describe('formatRetryAfter en minutos', () => {
  it('1 segundo se redondea a 1 minuto', () => {
    expect(formatRetryAfter(1)).toBe('1 minuto');
  });

  it('60 segundos son 1 minuto', () => {
    expect(formatRetryAfter(60)).toBe('1 minuto');
  });

  it('61 segundos se redondean hacia arriba a 2 minutos', () => {
    expect(formatRetryAfter(61)).toBe('2 minutos');
  });

  it('900 segundos son 15 minutos', () => {
    expect(formatRetryAfter(900)).toBe('15 minutos');
  });

  it('3600 segundos son 60 minutos si no se pide pasar a horas', () => {
    expect(formatRetryAfter(3600)).toBe('60 minutos');
  });

  it('sin tiempo, cero o negativo devuelve null', () => {
    expect(formatRetryAfter(null)).toBeNull();
    expect(formatRetryAfter(0)).toBeNull();
    expect(formatRetryAfter(-5)).toBeNull();
  });
});

describe('formatRetryAfter con paso a horas', () => {
  it('por debajo de 60 minutos sigue en minutos', () => {
    expect(formatRetryAfter(61, 'auto')).toBe('2 minutos');
    expect(formatRetryAfter(3540, 'auto')).toBe('59 minutos');
  });

  it('3600 segundos son 1 hora', () => {
    expect(formatRetryAfter(3600, 'auto')).toBe('1 hora');
  });

  it('un poco mas de una hora se redondea hacia arriba', () => {
    expect(formatRetryAfter(3601, 'auto')).toBe('2 horas');
    expect(formatRetryAfter(7200, 'auto')).toBe('2 horas');
  });
});
