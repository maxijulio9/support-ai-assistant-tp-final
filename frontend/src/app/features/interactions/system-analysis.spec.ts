import { analysisRows, confidencePercent, hasAnalysis } from './system-analysis';

const full = {
  category: 'Acceso',
  priority: 'High',
  system_decision: 'NEEDS_REVIEW',
  resolution_channel: 'REVIEWED_EDITED',
  confidence_score: 0.846,
};
const empty = { category: null, priority: null, system_decision: null, resolution_channel: null, confidence_score: null };

describe('confidencePercent', () => {
  it('redondea y acota entre 0 y 100', () => {
    expect(confidencePercent(0.846)).toBe(85);
    expect(confidencePercent(1.4)).toBe(100);
    expect(confidencePercent(-0.2)).toBe(0);
  });

  it('sin dato devuelve null', () => {
    expect(confidencePercent(null)).toBeNull();
    expect(confidencePercent(undefined)).toBeNull();
    expect(confidencePercent(Number.NaN)).toBeNull();
  });
});

describe('analysisRows', () => {
  it('arma las filas con etiquetas legibles, en orden', () => {
    expect(analysisRows(full)).toEqual([
      { label: 'Categoría', value: 'Acceso' },
      { label: 'Prioridad', value: 'High' },
      { label: 'Decisión original del sistema', value: 'Pendiente de revisión' },
      { label: 'Canal de resolución', value: 'Aprobada con edición' },
    ]);
  });

  it('omite las filas sin dato o en blanco', () => {
    expect(analysisRows({ ...full, category: null, priority: '  ', resolution_channel: null }).map((row) => row.label)).toEqual([
      'Decisión original del sistema',
    ]);
  });

  it('una decision desconocida se muestra legible', () => {
    expect(analysisRows({ ...empty, system_decision: 'UNA_DECISION_FUTURA' })[0].value).toBe('Una decision futura');
  });

  it('sin datos no hay filas', () => {
    expect(analysisRows(empty)).toEqual([]);
  });
});

describe('hasAnalysis', () => {
  it('con filas o con confianza hay algo para mostrar', () => {
    expect(hasAnalysis(full)).toBe(true);
    expect(hasAnalysis({ ...empty, confidence_score: 0.5 })).toBe(true);
    expect(hasAnalysis({ ...empty, category: 'Red' })).toBe(true);
  });

  it('sin nada no se muestra el bloque', () => {
    expect(hasAnalysis(empty)).toBe(false);
  });
});
