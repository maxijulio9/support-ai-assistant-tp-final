import { sparklineTrend } from './sparkline-trend';

describe('sparklineTrend', () => {
  it('serie vacia: sin variacion suficiente', () => {
    expect(sparklineTrend([])).toBe('sin variación suficiente para mostrar tendencia');
  });

  it('un solo punto con dato: sin variacion suficiente', () => {
    expect(sparklineTrend([1])).toBe('sin variación suficiente para mostrar tendencia');
  });

  it('todos nulos: sin variacion suficiente (0 puntos con dato)', () => {
    expect(sparklineTrend([null, null, null])).toBe('sin variación suficiente para mostrar tendencia');
  });

  it('alza clara', () => {
    expect(sparklineTrend([1, 2, 5])).toBe('tendencia en alza');
  });

  it('baja clara', () => {
    expect(sparklineTrend([5, 3, 1])).toBe('tendencia a la baja');
  });

  it('estable dentro de la tolerancia (variacion relativa menor al 5%)', () => {
    expect(sparklineTrend([1, 1.01])).toBe('tendencia estable');
  });

  it('variacion relativa justo por encima de la tolerancia: no es estable', () => {
    expect(sparklineTrend([1, 1.06])).toBe('tendencia en alza');
  });

  it('nulos mezclados: compara el primer y el ultimo valor con dato, ignora los huecos', () => {
    expect(sparklineTrend([null, 1, null, 5, null])).toBe('tendencia en alza');
  });

  it('punto de partida en cero, variacion chica: tolerancia absoluta, estable', () => {
    expect(sparklineTrend([0, 0.02])).toBe('tendencia estable');
  });

  it('punto de partida en cero, variacion grande: alza', () => {
    expect(sparklineTrend([0, 5])).toBe('tendencia en alza');
  });
});
