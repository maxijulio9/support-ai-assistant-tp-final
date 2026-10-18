import { percentGrowth, ppDelta, rate, rawDelta } from './kpi-metrics';

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
