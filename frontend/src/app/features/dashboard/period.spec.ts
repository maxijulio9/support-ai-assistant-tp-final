import { computePeriodRanges, previousPeriodOf, resolveDateRange } from './period';

describe('resolveDateRange', () => {
  const fallback = { from: '2026-09-13T00:00:00.000Z', to: '2026-10-13T00:00:00.000Z' };

  it('from y to ambos presentes: devuelve esos dos', () => {
    const result = resolveDateRange('2026-09-01T00:00:00.000Z', '2026-09-30T00:00:00.000Z', fallback);
    expect(result).toEqual({ from: '2026-09-01T00:00:00.000Z', to: '2026-09-30T00:00:00.000Z' });
  });

  it('solo from presente (sin to): devuelve el fallback completo, no mezcla', () => {
    const result = resolveDateRange('2026-09-01T00:00:00.000Z', null, fallback);
    expect(result).toEqual(fallback);
  });

  it('solo to presente (sin from): devuelve el fallback completo, no mezcla', () => {
    const result = resolveDateRange(null, '2026-09-30T00:00:00.000Z', fallback);
    expect(result).toEqual(fallback);
  });

  it('ninguno presente: devuelve el fallback completo', () => {
    const result = resolveDateRange(null, null, fallback);
    expect(result).toEqual(fallback);
  });
});

describe('previousPeriodOf', () => {
  it('devuelve un rango de la misma duracion, contiguo e inmediatamente anterior', () => {
    const current = { from: '2026-09-10T00:00:00.000Z', to: '2026-09-17T00:00:00.000Z' };
    const previous = previousPeriodOf(current);

    expect(previous.to).toBe(current.from);
    const currentDuration = new Date(current.to).getTime() - new Date(current.from).getTime();
    const previousDuration = new Date(previous.to).getTime() - new Date(previous.from).getTime();
    expect(previousDuration).toBe(currentDuration);
  });

  it('funciona con un rango libre que no es multiplo de dias exactos', () => {
    const current = { from: '2026-09-10T08:15:00.000Z', to: '2026-09-15T20:45:00.000Z' };
    const previous = previousPeriodOf(current);

    expect(previous.to).toBe(current.from);
    const currentDuration = new Date(current.to).getTime() - new Date(current.from).getTime();
    expect(new Date(previous.from).getTime()).toBe(new Date(current.from).getTime() - currentDuration);
  });
});

describe('computePeriodRanges', () => {
  it('hoy: actual es desde medianoche local hasta ahora, anterior es el dia calendario completo de ayer', () => {
    const now = new Date(2026, 8, 15, 14, 30, 0); // 15 sep 2026, 14:30 local
    const { current, previous } = computePeriodRanges('today', now);

    const expectedTodayMidnight = new Date(2026, 8, 15, 0, 0, 0).toISOString();
    const expectedYesterdayMidnight = new Date(2026, 8, 14, 0, 0, 0).toISOString();

    expect(current.from).toBe(expectedTodayMidnight);
    expect(current.to).toBe(now.toISOString());
    expect(previous.from).toBe(expectedYesterdayMidnight);
    expect(previous.to).toBe(expectedTodayMidnight);
  });

  it('hoy: el limite exacto de medianoche (00:00:00.000) ya cuenta como "hoy", no como ayer', () => {
    const midnight = new Date(2026, 8, 15, 0, 0, 0, 0);
    const { current, previous } = computePeriodRanges('today', midnight);

    expect(current.from).toBe(midnight.toISOString());
    expect(current.to).toBe(midnight.toISOString());
    expect(previous.to).toBe(midnight.toISOString());
    expect(previous.from).toBe(new Date(2026, 8, 14, 0, 0, 0, 0).toISOString());
  });

  it('hoy: 1ms antes de medianoche todavia pertenece al "anterior" (ayer)', () => {
    const justBeforeMidnight = new Date(2026, 8, 15, 0, 0, 0, 0).getTime() - 1;
    const { current } = computePeriodRanges('today', new Date(justBeforeMidnight));

    // El "current.from" para esa invocacion es la medianoche del 14, no del 15:
    // confirma que la funcion ancla "hoy" al dia calendario de la fecha dada,
    // no a un corte fijo de 24hs hacia atras.
    expect(current.from).toBe(new Date(2026, 8, 14, 0, 0, 0, 0).toISOString());
  });

  it('7 dias: ventana corrediza, el anterior es contiguo y de igual duracion', () => {
    const now = new Date(2026, 8, 15, 10, 0, 0);
    const { current, previous } = computePeriodRanges('7d', now);

    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    expect(new Date(current.from).getTime()).toBe(now.getTime() - sevenDaysMs);
    expect(current.to).toBe(now.toISOString());
    expect(previous.to).toBe(current.from);
    expect(new Date(previous.from).getTime()).toBe(new Date(current.from).getTime() - sevenDaysMs);
  });

  it('30 dias: ventana corrediza, el anterior es contiguo y de igual duracion', () => {
    const now = new Date(2026, 8, 15, 10, 0, 0);
    const { current, previous } = computePeriodRanges('30d', now);

    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    expect(new Date(current.from).getTime()).toBe(now.getTime() - thirtyDaysMs);
    expect(previous.to).toBe(current.from);
    expect(new Date(previous.from).getTime()).toBe(new Date(current.from).getTime() - thirtyDaysMs);
  });

  it('7d y 30d no usan la logica de medianoche de "hoy"', () => {
    const now = new Date(2026, 8, 15, 23, 59, 0);
    const { current: current7d } = computePeriodRanges('7d', now);
    const { current: current30d } = computePeriodRanges('30d', now);
    // si usaran medianoche, current.to seria distinto de "now" exacto
    expect(current7d.to).toBe(now.toISOString());
    expect(current30d.to).toBe(now.toISOString());
  });
});
