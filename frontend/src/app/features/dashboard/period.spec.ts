import {
  calendarDaysToInstantRange,
  computePeriodRanges,
  defaultMetricsRange,
  lastDayOfInstantRange,
  previousPeriodOf,
  resolveDateRange,
} from './period';

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

describe('calendarDaysToInstantRange', () => {
  it('from es la medianoche local del primer dia, to es la medianoche local del dia siguiente al ultimo (la hora de los Date recibidos se ignora)', () => {
    const firstDay = new Date(2026, 8, 14, 10, 0, 0);
    const lastDay = new Date(2026, 9, 14, 23, 59, 0);
    const range = calendarDaysToInstantRange(firstDay, lastDay);

    expect(range.from).toBe(new Date(2026, 8, 14, 0, 0, 0, 0).toISOString());
    expect(range.to).toBe(new Date(2026, 9, 15, 0, 0, 0, 0).toISOString());
  });

  it('un solo dia: el extremo superior exclusivo deja un rango de exactamente 24hs, incluyendo el dia completo', () => {
    const day = new Date(2026, 8, 20, 12, 0, 0);
    const range = calendarDaysToInstantRange(day, day);

    const durationMs = new Date(range.to).getTime() - new Date(range.from).getTime();
    expect(durationMs).toBe(24 * 60 * 60 * 1000);
  });

  it('cruza el limite de un dia en UTC-3: 14 de septiembre a las 23:50 hora local sigue anclado al 14, aunque ese instante ya sea 15 de septiembre en UTC', () => {
    const lateNightLocal = new Date(2026, 8, 14, 23, 50, 0);
    const range = calendarDaysToInstantRange(lateNightLocal, lateNightLocal);

    // Verificacion independiente del huso de la maquina: el dia local sigue
    // siendo el 14, no el 15 (que es a lo que daria si se usaran getters UTC).
    expect(range.from).toBe(new Date(2026, 8, 14, 0, 0, 0, 0).toISOString());
    expect(range.to).toBe(new Date(2026, 8, 15, 0, 0, 0, 0).toISOString());

    // Verificacion explicita en UTC-3 (America/Argentina/La_Rioja, el huso de
    // este entorno): medianoche local del 14/sep es 03:00 UTC del mismo 14,
    // no del 15 - el instante de las 23:50 local (02:50 UTC del 15) queda del
    // lado correcto aunque su propio dia en UTC ya haya cruzado.
    expect(range.from).toBe('2026-09-14T03:00:00.000Z');
    expect(range.to).toBe('2026-09-15T03:00:00.000Z');
  });
});

describe('lastDayOfInstantRange', () => {
  it('resta 1 ms al "to" exclusivo para caer dentro del ultimo dia elegido', () => {
    const to = new Date(2026, 9, 15, 0, 0, 0, 0).toISOString();
    const lastDay = lastDayOfInstantRange(to);

    expect(lastDay.getFullYear()).toBe(2026);
    expect(lastDay.getMonth()).toBe(9);
    expect(lastDay.getDate()).toBe(14);
  });

  it('es la inversa exacta del extremo superior de calendarDaysToInstantRange', () => {
    const lastDay = new Date(2026, 8, 20);
    const range = calendarDaysToInstantRange(lastDay, lastDay);
    const recovered = lastDayOfInstantRange(range.to);

    expect(recovered.getFullYear()).toBe(lastDay.getFullYear());
    expect(recovered.getMonth()).toBe(lastDay.getMonth());
    expect(recovered.getDate()).toBe(lastDay.getDate());
  });
});

describe('defaultMetricsRange', () => {
  it('ultimos 30 dias calendario incluyendo hoy: de "hace 29 dias" a hoy, medianoche local a medianoche local del dia siguiente', () => {
    const now = new Date(2026, 9, 14, 16, 45, 0);
    const range = defaultMetricsRange(now);

    expect(range.from).toBe(new Date(2026, 8, 15, 0, 0, 0, 0).toISOString());
    expect(range.to).toBe(new Date(2026, 9, 15, 0, 0, 0, 0).toISOString());
  });

  it('cubre exactamente 30 dias completos, sin importar la hora de "now"', () => {
    const now = new Date(2026, 9, 14, 9, 0, 0);
    const range = defaultMetricsRange(now);

    const durationMs = new Date(range.to).getTime() - new Date(range.from).getTime();
    expect(durationMs).toBe(30 * 24 * 60 * 60 * 1000);
  });
});
