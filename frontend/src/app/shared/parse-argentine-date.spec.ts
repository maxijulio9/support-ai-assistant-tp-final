import { parseArgentineDate } from './parse-argentine-date';

const ymd = (date: Date | null) => (date ? [date.getFullYear(), date.getMonth() + 1, date.getDate()] : null);

describe('parseArgentineDate', () => {
  it('lee dia/mes/año, no mes/dia', () => {
    expect(ymd(parseArgentineDate('3/11/2026'))).toEqual([2026, 11, 3]);
    expect(ymd(parseArgentineDate('25/12/2025'))).toEqual([2025, 12, 25]);
  });

  it('acepta ceros, espacios y otros separadores', () => {
    expect(ymd(parseArgentineDate(' 03/11/2026 '))).toEqual([2026, 11, 3]);
    expect(ymd(parseArgentineDate('3-11-2026'))).toEqual([2026, 11, 3]);
    expect(ymd(parseArgentineDate('3.11.2026'))).toEqual([2026, 11, 3]);
  });

  it('acepta AAAA-MM-DD', () => {
    expect(ymd(parseArgentineDate('2026-11-03'))).toEqual([2026, 11, 3]);
  });

  it.each(['', 'hoy', '31/02/2026', '2026-02-30', '13/13/2026', '1/1/26', '3/11', '3/11/2026 10:00'])(
    'devuelve null con %j',
    (value) => {
      expect(parseArgentineDate(value)).toBeNull();
    },
  );
});
