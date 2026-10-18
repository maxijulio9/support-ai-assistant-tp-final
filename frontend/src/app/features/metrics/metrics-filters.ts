import { isKnownDecisionValue } from './decision-segments';

export interface MetricsFilters {
  category: string | null;
  decision: string | null;
}

// Lee category y decision de los query params. category: cualquier texto no
// vacio, recortado, tal cual (no se valida contra una lista en vivo: el
// backend puede traer variantes de escritura que no hay que normalizar).
// decision: se valida contra los 6 valores reales del contrato, se ignora
// si no coincide con ninguno.
export function resolveMetricsFilters(categoryParam: string | null, decisionParam: string | null): MetricsFilters {
  const trimmedCategory = categoryParam !== null ? categoryParam.trim() : '';
  const decision = decisionParam !== null && isKnownDecisionValue(decisionParam) ? decisionParam : null;

  return {
    category: trimmedCategory.length > 0 ? trimmedCategory : null,
    decision,
  };
}
