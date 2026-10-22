import { DECISION_SEGMENTS, DecisionSegmentCounts, decisionSegmentValue, roundedSegmentPercentages } from './decision-segments';

describe('DECISION_SEGMENTS', () => {
  it('tiene 6 segmentos: las 5 decisiones mapeadas mas el grupo de resueltas', () => {
    expect(DECISION_SEGMENTS.length).toBe(6);
    expect(DECISION_SEGMENTS.map((segment) => segment.key)).toEqual([
      'AUTO_PUBLISH',
      'NEEDS_REVIEW',
      'ESCALATE',
      'REQUEST_INFO',
      'DISCARDED',
      'RESOLVED_GROUP',
    ]);
  });

  it('DISCARDED tiene el label "Descartada" y tono neutral', () => {
    const discarded = DECISION_SEGMENTS.find((segment) => segment.key === 'DISCARDED');
    expect(discarded).toEqual({ key: 'DISCARDED', label: 'Descartada', tone: 'neutral' });
  });
});

describe('decisionSegmentValue', () => {
  const counts: DecisionSegmentCounts = {
    auto_publish_count: 10,
    needs_review_count: 2,
    escalate_count: 5,
    request_info_count: 3,
    discarded_count: 6,
    resolved_count: 4,
    resolved_externally_count: 1,
  };

  it('devuelve el campo correspondiente para cada una de las 5 decisiones mapeadas', () => {
    expect(decisionSegmentValue(counts, 'AUTO_PUBLISH')).toBe(10);
    expect(decisionSegmentValue(counts, 'NEEDS_REVIEW')).toBe(2);
    expect(decisionSegmentValue(counts, 'ESCALATE')).toBe(5);
    expect(decisionSegmentValue(counts, 'REQUEST_INFO')).toBe(3);
    expect(decisionSegmentValue(counts, 'DISCARDED')).toBe(6);
  });

  it('el grupo "Resueltas" suma resolved_count y resolved_externally_count', () => {
    expect(decisionSegmentValue(counts, 'RESOLVED_GROUP')).toBe(5);
  });

  it('los 7 conteos (6 segmentos, el grupo de resueltas cuenta como 2) suman total_interactions', () => {
    const total = 10 + 2 + 5 + 3 + 6 + 4 + 1;
    const sumOfSegments = DECISION_SEGMENTS.reduce((sum, segment) => sum + decisionSegmentValue(counts, segment.key), 0);
    expect(sumOfSegments).toBe(total);
  });

  it('un segmento en 0 no rompe nada: sigue devolviendo 0, no undefined ni NaN', () => {
    const zeroCounts: DecisionSegmentCounts = { ...counts, discarded_count: 0 };
    expect(decisionSegmentValue(zeroCounts, 'DISCARDED')).toBe(0);
  });
});

describe('roundedSegmentPercentages', () => {
  it('total 0: todos los porcentajes quedan en 0, sin dividir por cero', () => {
    const result = roundedSegmentPercentages([0, 0, 0, 0, 0], 0);
    expect(result).toEqual([0, 0, 0, 0, 0]);
  });

  it('tres segmentos iguales (33.33...% cada uno): el redondeo independiente daria 99.9, el ajuste va al primero en empate', () => {
    const result = roundedSegmentPercentages([1, 1, 1], 3);
    expect(result).toEqual([33.4, 33.3, 33.3]);
    expect(result.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 10);
  });

  it('sin error de redondeo: la suma da 100.0 directo, no hace falta ajustar', () => {
    const result = roundedSegmentPercentages([50, 50], 100);
    expect(result).toEqual([50, 50]);
  });

  it('el ajuste cae en el segmento de mayor cantidad, no en el primero del array', () => {
    // 29/59, 1/59, 19/59, 7/59, 3/59 redondeados suman 100.1: el ajuste de
    // -0.1 tiene que caer en 29 (el mayor), no en el primero porque ya lo es.
    const result = roundedSegmentPercentages([29, 1, 19, 7, 3], 59);
    expect(result).toEqual([49.1, 1.7, 32.2, 11.9, 5.1]);
    expect(result.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 10);
  });

  it('un segmento en 0 (por ejemplo discarded_count todavia sin uso) da 0%, no NaN ni undefined, y no rompe la suma', () => {
    const result = roundedSegmentPercentages([10, 0, 5], 15);
    expect(result[1]).toBe(0);
    expect(result.every((value) => Number.isFinite(value))).toBe(true);
    expect(result.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 10);
  });
});
