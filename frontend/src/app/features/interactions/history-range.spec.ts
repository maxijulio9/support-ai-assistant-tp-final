import { dayEndInstant, dayStartInstant, rangeApiParams, resolveHistoryRange } from './history-range';

const TODAY = new Date(2026, 10, 9, 15, 30);

describe('rangeApiParams', () => {
  it('sin rango no manda parametros', () => {
    expect(rangeApiParams(null)).toEqual({});
  });

  it('abarca el dia argentino completo, de la medianoche al ultimo instante', () => {
    expect(rangeApiParams({ from: '2026-11-05', to: '2026-11-07' })).toEqual({
      from_date: '2026-11-05T00:00:00-03:00',
      to_date: '2026-11-07T23:59:59.999999-03:00',
    });
  });

  it('un solo dia va de su inicio a su fin', () => {
    const params = rangeApiParams({ from: '2026-11-05', to: '2026-11-05' });

    expect(params.from_date).toBe(dayStartInstant('2026-11-05'));
    expect(params.to_date).toBe(dayEndInstant('2026-11-05'));
  });

  it('los instantes equivalen a 03:00 UTC del dia y a 02:59:59 UTC del siguiente', () => {
    expect(new Date(dayStartInstant('2026-11-05')).toISOString()).toBe('2026-11-05T03:00:00.000Z');
    expect(new Date(dayEndInstant('2026-11-05')).toISOString()).toBe('2026-11-06T02:59:59.999Z');
  });

  it('una interaccion a las 23:30 de Argentina cae dentro de ese dia, y la de las 00:10 del siguiente no', () => {
    const { from_date, to_date } = rangeApiParams({ from: '2026-11-05', to: '2026-11-05' });
    const inside = new Date('2026-11-06T02:30:00Z').getTime();
    const next = new Date('2026-11-06T03:10:00Z').getTime();

    expect(inside >= new Date(from_date!).getTime() && inside <= new Date(to_date!).getTime()).toBe(true);
    expect(next <= new Date(to_date!).getTime()).toBe(false);
  });
});

describe('resolveHistoryRange', () => {
  it('acepta un rango valido', () => {
    expect(resolveHistoryRange('2026-11-01', '2026-11-05', TODAY)).toEqual({ from: '2026-11-01', to: '2026-11-05' });
  });

  it('acepta un solo dia y llegar hasta hoy', () => {
    expect(resolveHistoryRange('2026-11-09', '2026-11-09', TODAY)).toEqual({ from: '2026-11-09', to: '2026-11-09' });
  });

  it('sin alguno de los dos extremos no hay rango', () => {
    expect(resolveHistoryRange('2026-11-01', null, TODAY)).toBeNull();
    expect(resolveHistoryRange(null, '2026-11-05', TODAY)).toBeNull();
    expect(resolveHistoryRange(null, null, TODAY)).toBeNull();
    expect(resolveHistoryRange('', '', TODAY)).toBeNull();
  });

  it.each(['2026-11-1', '01/11/2026', '2026-13-01', '2026-02-30', 'hoy', '2026-11-01T00:00:00Z'])(
    'una fecha invalida (%j) se ignora',
    (value) => {
      expect(resolveHistoryRange(value, '2026-11-05', TODAY)).toBeNull();
      expect(resolveHistoryRange('2026-11-01', value, TODAY)).toBeNull();
    },
  );

  it('desde mayor que hasta se ignora', () => {
    expect(resolveHistoryRange('2026-11-06', '2026-11-05', TODAY)).toBeNull();
  });

  it('una fecha futura se ignora', () => {
    expect(resolveHistoryRange('2026-11-01', '2026-11-10', TODAY)).toBeNull();
    expect(resolveHistoryRange('2026-11-10', '2026-11-12', TODAY)).toBeNull();
  });

  it('cruza de año sin problema', () => {
    expect(resolveHistoryRange('2025-12-30', '2026-01-02', TODAY)).toEqual({ from: '2025-12-30', to: '2026-01-02' });
  });
});
