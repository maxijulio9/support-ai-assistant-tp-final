import { CategoryMetric } from '../../api/models/category-metric';

// Orden de "Confianza media por categoria": confianza descendente, con las
// categorias en null al final (no hay con que rankearlas en el medio de una
// lista ordenada por valor). Desempate estable: primero por volumen
// descendente, despues por nombre ascendente.
export function sortByConfidence(categories: CategoryMetric[]): CategoryMetric[] {
  return categories.slice().sort((a, b) => {
    if (a.avg_confidence_score === null && b.avg_confidence_score === null) {
      return tieBreak(a, b);
    }
    if (a.avg_confidence_score === null) return 1;
    if (b.avg_confidence_score === null) return -1;
    if (a.avg_confidence_score !== b.avg_confidence_score) {
      return b.avg_confidence_score - a.avg_confidence_score;
    }
    return tieBreak(a, b);
  });
}

function tieBreak(a: CategoryMetric, b: CategoryMetric): number {
  if (a.total_interactions !== b.total_interactions) {
    return b.total_interactions - a.total_interactions;
  }
  return a.category.localeCompare(b.category);
}
