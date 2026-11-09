import { formatRelativeTime } from './format-relative-time';

// Todas las fechas se arman con el constructor local para que el spec no
// dependa de la zona horaria de la maquina que lo corre.
const iso = (year: number, month: number, day: number, hour = 0, minute = 0, second = 0) =>
  new Date(year, month - 1, day, hour, minute, second).toISOString();
const NOW = new Date(2026, 10, 9, 15, 0, 0);

describe('formatRelativeTime', () => {
  it('sin valor o con un valor invalido devuelve vacio', () => {
    expect(formatRelativeTime(null, NOW)).toBe('');
    expect(formatRelativeTime(undefined, NOW)).toBe('');
    expect(formatRelativeTime('', NOW)).toBe('');
    expect(formatRelativeTime('no es una fecha', NOW)).toBe('');
  });

  it('menos de 1 minuto es "hace un momento"', () => {
    expect(formatRelativeTime(iso(2026, 11, 9, 14, 59, 30), NOW)).toBe('hace un momento');
    expect(formatRelativeTime(iso(2026, 11, 9, 15, 0, 0), NOW)).toBe('hace un momento');
  });

  it('una fecha apenas en el futuro tambien es "hace un momento"', () => {
    expect(formatRelativeTime(iso(2026, 11, 9, 15, 0, 20), NOW)).toBe('hace un momento');
  });

  it('hace 20 minutos', () => {
    expect(formatRelativeTime(iso(2026, 11, 9, 14, 40), NOW)).toBe('hace 20 minutos');
  });

  it('hace 1 minuto va en singular', () => {
    expect(formatRelativeTime(iso(2026, 11, 9, 14, 58, 30), NOW)).toBe('hace 1 minuto');
  });

  it('59 minutos sigue siendo en minutos y 1 hora pasa a "hoy"', () => {
    expect(formatRelativeTime(iso(2026, 11, 9, 14, 1), NOW)).toBe('hace 59 minutos');
    expect(formatRelativeTime(iso(2026, 11, 9, 14, 0), NOW)).toBe('hoy, 14:00');
  });

  it('hoy a la mañana muestra la hora', () => {
    expect(formatRelativeTime(iso(2026, 11, 9, 8, 5), NOW)).toBe('hoy, 08:05');
  });

  it('anoche (ayer a las 21:57) es "ayer" aunque hayan pasado pocas horas', () => {
    const lateNow = new Date(2026, 10, 9, 7, 0, 0);

    expect(formatRelativeTime(iso(2026, 11, 8, 21, 57), lateNow)).toBe('ayer, 21:57');
    expect(formatRelativeTime(iso(2026, 11, 8, 21, 57), NOW)).toBe('ayer, 21:57');
  });

  it('hace 3 dias muestra la fecha corta', () => {
    expect(formatRelativeTime(iso(2026, 11, 6, 15, 0), NOW)).toBe('6 nov, 15:00');
  });

  it('5 de octubre y 7 de noviembre muestran dia, mes y hora, sin ayer', () => {
    expect(formatRelativeTime(iso(2026, 10, 5, 21, 57), NOW)).toBe('5 oct, 21:57');
    expect(formatRelativeTime(iso(2026, 11, 7, 21, 57), NOW)).toBe('7 nov, 21:57');
  });

  it('de otro año muestra el año', () => {
    expect(formatRelativeTime(iso(2025, 10, 5, 21, 57), NOW)).toBe('5 oct 2025, 21:57');
  });

  it('cambio de año: el 31 de diciembre visto el 1 de enero es "ayer"', () => {
    const newYear = new Date(2027, 0, 1, 10, 0, 0);

    expect(formatRelativeTime(iso(2026, 12, 31, 23, 30), newYear)).toBe('ayer, 23:30');
    expect(formatRelativeTime(iso(2026, 12, 30, 23, 30), newYear)).toBe('30 dic 2026, 23:30');
  });

  it('borde de medianoche: 23:59 de ayer es "ayer" y 00:00 de hoy es "hoy"', () => {
    const afterMidnight = new Date(2026, 10, 9, 0, 30, 0);

    expect(formatRelativeTime(iso(2026, 11, 8, 23, 59), afterMidnight)).toBe('hace 31 minutos');
    expect(formatRelativeTime(iso(2026, 11, 8, 23, 59), NOW)).toBe('ayer, 23:59');
    expect(formatRelativeTime(iso(2026, 11, 9, 0, 0), NOW)).toBe('hoy, 00:00');
  });

  it('borde de medianoche con mas de 1 hora: lo de las 23:00 es ayer, lo de las 00:10 es hoy', () => {
    const early = new Date(2026, 10, 9, 2, 0, 0);

    expect(formatRelativeTime(iso(2026, 11, 8, 23, 0), early)).toBe('ayer, 23:00');
    expect(formatRelativeTime(iso(2026, 11, 9, 0, 10), early)).toBe('hoy, 00:10');
  });

  it('antes de ayer nunca dice ayer, aunque falten menos de 48 horas', () => {
    const morning = new Date(2026, 10, 9, 6, 0, 0);

    expect(formatRelativeTime(iso(2026, 11, 7, 20, 0), morning)).toBe('7 nov, 20:00');
  });

  it('ningun resultado usa guiones largos', () => {
    for (const value of [iso(2026, 11, 9, 14, 40), iso(2026, 11, 8, 21, 57), iso(2025, 10, 5, 21, 57)]) {
      expect(formatRelativeTime(value, NOW)).not.toMatch(/[–—]/);
    }
  });
});
