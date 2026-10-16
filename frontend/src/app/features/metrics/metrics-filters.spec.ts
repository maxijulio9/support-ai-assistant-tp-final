import { resolveMetricsFilters } from './metrics-filters';

describe('resolveMetricsFilters', () => {
  it('ausencia de ambos: los dos quedan en null', () => {
    const result = resolveMetricsFilters(null, null);
    expect(result).toEqual({ category: null, decision: null });
  });

  it('decision valida: se devuelve tal cual', () => {
    const result = resolveMetricsFilters(null, 'ESCALATE');
    expect(result.decision).toBe('ESCALATE');
  });

  it('decision invalida: se ignora (queda en null)', () => {
    const result = resolveMetricsFilters(null, 'NO_EXISTE');
    expect(result.decision).toBeNull();
  });

  it('categoria vacia: queda en null', () => {
    const result = resolveMetricsFilters('', null);
    expect(result.category).toBeNull();
  });

  it('categoria con espacios: se recorta', () => {
    const result = resolveMetricsFilters('  Facturación y comisiones  ', null);
    expect(result.category).toBe('Facturación y comisiones');
  });

  it('categoria solo con espacios: queda en null, no un string vacio', () => {
    const result = resolveMetricsFilters('   ', null);
    expect(result.category).toBeNull();
  });

  it('categoria con variante de escritura: se acepta tal cual, sin normalizar', () => {
    const result = resolveMetricsFilters('Verificação de identidade', null);
    expect(result.category).toBe('Verificação de identidade');
  });

  it('los dos presentes y validos', () => {
    const result = resolveMetricsFilters('Soporte técnico', 'RESOLVED_EXTERNALLY');
    expect(result).toEqual({ category: 'Soporte técnico', decision: 'RESOLVED_EXTERNALLY' });
  });
});
