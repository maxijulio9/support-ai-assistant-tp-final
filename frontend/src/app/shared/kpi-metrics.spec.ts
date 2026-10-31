import { formatDelta, percentGrowth, ppDelta, rate, rawDelta } from './kpi-metrics';

describe('rate', () => {
  it('calcula la tasa normal', () => {
    expect(rate(70, 100)).toBe(0.7);
  });

  it('total 0: devuelve null, no divide por cero', () => {
    expect(rate(0, 0)).toBeNull();
  });

  it('count 0 con total positivo: devuelve 0, no null', () => {
    expect(rate(0, 50)).toBe(0);
  });
});

describe('ppDelta', () => {
  it('suba: delta positivo', () => {
    expect(ppDelta(0.7, 0.636)).toBeCloseTo(6.4, 5);
  });

  it('baja: delta negativo', () => {
    expect(ppDelta(0.08, 0.101)).toBeCloseTo(-2.1, 5);
  });

  it('periodo anterior sin datos (null): devuelve null', () => {
    expect(ppDelta(0.7, null)).toBeNull();
  });

  it('periodo actual sin datos (null): devuelve null', () => {
    expect(ppDelta(null, 0.7)).toBeNull();
  });

  it('ambos null: devuelve null', () => {
    expect(ppDelta(null, null)).toBeNull();
  });
});

describe('rawDelta', () => {
  it('suba: delta positivo', () => {
    expect(rawDelta(0.92, 0.89)).toBeCloseTo(0.03, 5);
  });

  it('baja: delta negativo', () => {
    expect(rawDelta(0.89, 0.92)).toBeCloseTo(-0.03, 5);
  });

  it('periodo anterior sin datos (null): devuelve null', () => {
    expect(rawDelta(0.92, null)).toBeNull();
  });

  it('periodo actual sin datos (null): devuelve null', () => {
    expect(rawDelta(null, 0.92)).toBeNull();
  });
});

describe('percentGrowth', () => {
  it('suba: crecimiento positivo', () => {
    expect(percentGrowth(1248, 1110)).toBeCloseTo(12.4324, 3);
  });

  it('baja: crecimiento negativo', () => {
    expect(percentGrowth(1110, 1248)).toBeCloseTo(-11.0577, 3);
  });

  it('periodo anterior en 0: devuelve null, no divide por cero', () => {
    expect(percentGrowth(100, 0)).toBeNull();
  });

  it('periodo anterior sin datos (null): devuelve null', () => {
    expect(percentGrowth(100, null)).toBeNull();
  });

  it('periodo actual sin datos (null): devuelve null', () => {
    expect(percentGrowth(null, 100)).toBeNull();
  });
});

describe('formatDelta', () => {
  it('una baja muestra la flecha hacia abajo y el valor sin signo menos', () => {
    const delta = formatDelta(-38.8, 'pp', 1, true)!;
    expect(delta.direction).toBe('down');
    expect(delta.arrow).toBe('▼');
    expect(delta.text).toBe('38,8 pp');
    expect(delta.text).not.toContain('-');
  });

  it('una suba muestra la flecha hacia arriba y el valor sin signo mas', () => {
    const delta = formatDelta(2.6, 'pp', 1, true)!;
    expect(delta.arrow).toBe('▲');
    expect(delta.text).toBe('2,6 pp');
    expect(delta.text).not.toContain('+');
  });

  it('usa coma decimal y la cantidad de decimales pedida', () => {
    expect(formatDelta(0.0512, 'raw', 2, true)!.text).toBe('0,05');
    expect(formatDelta(12, 'pp', 1, true)!.text).toBe('12,0 pp');
  });

  it('subir es bueno: suba en verde, baja en rojo', () => {
    expect(formatDelta(1, 'pp', 1, true)!.tone).toBe('good');
    expect(formatDelta(-1, 'pp', 1, true)!.tone).toBe('bad');
  });

  it('subir es malo (escaladas): baja en verde, suba en rojo', () => {
    expect(formatDelta(-3, 'pp', 1, false)!.tone).toBe('good');
    expect(formatDelta(3, 'pp', 1, false)!.tone).toBe('bad');
  });

  it('un cambio que se redondea a cero es "sin cambios" y neutro', () => {
    const delta = formatDelta(-0.04, 'pp', 1, true)!;
    expect(delta.direction).toBe('flat');
    expect(delta.tone).toBe('neutral');
    expect(delta.text).toBe('0,0 pp');
    expect(delta.spoken).toBe('sin cambios respecto del período anterior');
  });

  it('la lectura accesible dice la direccion con palabras y la unidad', () => {
    expect(formatDelta(-38.8, 'pp', 1, true)!.spoken).toBe('bajó 38,8 puntos porcentuales respecto del período anterior');
    expect(formatDelta(0.05, 'raw', 2, true)!.spoken).toBe('subió 0,05 respecto del período anterior');
  });

  it('sin delta (null o no finito) devuelve null', () => {
    expect(formatDelta(null, 'pp', 1, true)).toBeNull();
    expect(formatDelta(Number.NaN, 'pp', 1, true)).toBeNull();
  });
});
