import { CategoryMetric } from '../../api/models/category-metric';
import { sortByConfidence } from './category-confidence-order';

function category(name: string, score: number | null, total: number): CategoryMetric {
  return {
    category: name,
    avg_confidence_score: score,
    total_interactions: total,
    auto_publish_count: 0,
    automatic_resolution_rate: 0,
  };
}

describe('sortByConfidence', () => {
  it('lista vacia: devuelve una lista vacia', () => {
    expect(sortByConfidence([])).toEqual([]);
  });

  it('nulos mezclados: las categorias con puntaje van primero, descendente, y las null al final', () => {
    const result = sortByConfidence([
      category('B', null, 20),
      category('A', 0.5, 10),
      category('C', 0.8, 5),
    ]);
    expect(result.map((c) => c.category)).toEqual(['C', 'A', 'B']);
  });

  it('todas en null: se ordenan por volumen descendente', () => {
    const result = sortByConfidence([category('B', null, 5), category('A', null, 10)]);
    expect(result.map((c) => c.category)).toEqual(['A', 'B']);
  });

  it('empate de valores: desempata por volumen descendente', () => {
    const result = sortByConfidence([category('B', 0.7, 5), category('A', 0.7, 10)]);
    expect(result.map((c) => c.category)).toEqual(['A', 'B']);
  });

  it('empate de valores y de volumen: desempata por nombre ascendente', () => {
    const result = sortByConfidence([category('Zeta', 0.7, 5), category('Alpha', 0.7, 5)]);
    expect(result.map((c) => c.category)).toEqual(['Alpha', 'Zeta']);
  });

  it('no muta el arreglo original', () => {
    const original = [category('B', 0.5, 5), category('A', 0.8, 10)];
    const originalOrder = original.map((c) => c.category);
    sortByConfidence(original);
    expect(original.map((c) => c.category)).toEqual(originalOrder);
  });
});
