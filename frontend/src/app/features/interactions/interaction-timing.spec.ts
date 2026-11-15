import { buildTimeline, formatDuration, responseTimeText } from './interaction-timing';

const now = new Date(2026, 10, 9, 12, 0);
const at = (day: number, h: number, m: number, s = 0) => new Date(2026, 10, day, h, m, s).toISOString();

describe('formatDuration', () => {
  it.each([
    [0, '0 s'],
    [45_000, '45 s'],
    [72_000, '1 min 12 s'],
    [120_000, '2 min'],
    [3_900_000, '1 h 5 min'],
    [7_200_000, '2 h'],
    [97_200_000, '1 d 3 h'],
    [86_400_000, '1 d'],
  ])('%d ms es %s', (ms, text) => {
    expect(formatDuration(ms)).toBe(text);
  });

  it('redondea al segundo y rechaza lo invalido', () => {
    expect(formatDuration(1_400)).toBe('1 s');
    expect(formatDuration(59_600)).toBe('1 min');
    expect(formatDuration(-1)).toBe('');
    expect(formatDuration(Number.NaN)).toBe('');
  });
});

describe('responseTimeText', () => {
  const base = { created_at: at(9, 10, 0, 0), responded_at: at(9, 10, 1, 12), reviewed_at: null };

  it('con respuesta y sin revision muestra la diferencia', () => {
    expect(responseTimeText(base)).toBe('1 min 12 s');
  });

  it('sin respuesta no se muestra', () => {
    expect(responseTimeText({ ...base, responded_at: null })).toBeNull();
    expect(responseTimeText({ ...base, responded_at: undefined })).toBeNull();
  });

  it('con revision humana no se muestra, aunque haya respuesta', () => {
    expect(responseTimeText({ ...base, reviewed_at: at(9, 10, 30) })).toBeNull();
  });

  it('sin fecha de registro, con fechas ilegibles o con la respuesta antes del registro no se muestra', () => {
    expect(responseTimeText({ ...base, created_at: null })).toBeNull();
    expect(responseTimeText({ ...base, responded_at: 'basura' })).toBeNull();
    expect(responseTimeText({ ...base, responded_at: at(9, 9, 0) })).toBeNull();
  });

  it('respuesta en el mismo instante: 0 s', () => {
    expect(responseTimeText({ ...base, responded_at: base.created_at })).toBe('0 s');
  });
});

describe('buildTimeline', () => {
  const full = {
    decision: 'AUTO_PUBLISH',
    created_at: at(9, 10, 0),
    generated_at: at(9, 10, 1),
    reviewed_at: at(9, 10, 5),
    reviewed_by_name: 'Ana Pérez',
    responded_at: at(9, 10, 6),
  };

  it('con todas las fechas, en orden', () => {
    expect(buildTimeline(full, now).map((event) => [event.label, event.date])).toEqual([
      ['Interacción registrada', '9 nov, 10:00'],
      ['Respuesta sugerida generada', '9 nov, 10:01'],
      ['Revisada por Ana Pérez', '9 nov, 10:05'],
      ['Publicada al cliente', '9 nov, 10:06'],
    ]);
  });

  it('omite las fechas nulas o ilegibles', () => {
    const events = buildTimeline({ ...full, generated_at: null, reviewed_at: null, responded_at: 'basura' }, now);
    expect(events.map((event) => event.key)).toEqual(['created']);
  });

  it('revisada sin nombre', () => {
    const events = buildTimeline({ ...full, reviewed_by_name: null }, now);
    expect(events.find((event) => event.key === 'reviewed')?.label).toBe('Revisada');
  });

  it('con publicacion fallida reemplaza al ultimo hito y se muestra aunque no tenga fecha', () => {
    const events = buildTimeline({ ...full, decision: 'PUBLISH_FAILED', responded_at: null }, now);
    expect(events.at(-1)).toEqual({ key: 'failed', label: 'Falló la publicación', date: null, tone: 'failed' });
    expect(events.some((event) => event.label === 'Publicada al cliente')).toBe(false);
  });

  it('con publicacion fallida y fecha de respuesta, la muestra', () => {
    const events = buildTimeline({ ...full, decision: 'PUBLISH_FAILED' }, now);
    expect(events.at(-1)?.date).toBe('9 nov, 10:06');
  });

  it('sin ninguna fecha queda vacia', () => {
    expect(buildTimeline({ decision: null, created_at: null, generated_at: null, reviewed_at: null, reviewed_by_name: null, responded_at: null }, now)).toEqual([]);
  });
});
