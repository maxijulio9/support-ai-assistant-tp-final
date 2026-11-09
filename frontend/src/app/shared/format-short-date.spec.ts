import { formatShortDate } from './format-short-date';

// Fechas con el constructor local para no depender de la zona de la maquina
const iso = (year: number, month: number, day: number, hour = 0, minute = 0) =>
  new Date(year, month - 1, day, hour, minute).toISOString();
const NOW = new Date(2026, 10, 9, 15, 0, 0);

describe('formatShortDate', () => {
  it('del año actual no muestra el año', () => {
    expect(formatShortDate(iso(2026, 10, 5, 21, 57), NOW)).toBe('5 oct, 21:57');
  });

  it('de otro año muestra el año', () => {
    expect(formatShortDate(iso(2025, 10, 5, 21, 57), NOW)).toBe('5 oct 2025, 21:57');
    expect(formatShortDate(iso(2027, 1, 2, 8, 5), NOW)).toBe('2 ene 2027, 08:05');
  });

  it('el 31 de diciembre y el 1 de enero caen en años distintos', () => {
    expect(formatShortDate(iso(2026, 12, 31, 23, 59), NOW)).toBe('31 dic, 23:59');
    expect(formatShortDate(iso(2026, 12, 31, 23, 59), new Date(2027, 0, 1, 10, 0))).toBe('31 dic 2026, 23:59');
  });

  it('medianoche se muestra como 00:00', () => {
    expect(formatShortDate(iso(2026, 11, 9, 0, 0), NOW)).toBe('9 nov, 00:00');
  });

  it('sin valor o con un valor invalido devuelve vacio', () => {
    expect(formatShortDate(null, NOW)).toBe('');
    expect(formatShortDate(undefined, NOW)).toBe('');
    expect(formatShortDate('no es una fecha', NOW)).toBe('');
  });

  it('no usa guiones largos', () => {
    expect(formatShortDate(iso(2025, 10, 5, 21, 57), NOW)).not.toMatch(/[–—]/);
  });
});
