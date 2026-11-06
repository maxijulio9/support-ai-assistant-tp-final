import { CategoryMetric } from '../../api/models/category-metric';
import {
  buildCategoryRows,
  categorySubtitle,
  categoryToggleLabel,
  formatCount,
  formatPercent,
  isCategoryListFoldable,
  visibleCategoryRows,
} from './category-list';

function category(name: string, total: number): CategoryMetric {
  return { category: name, total_interactions: total, auto_publish_count: 0, automatic_resolution_rate: 0, avg_confidence_score: null };
}

describe('categorySubtitle', () => {
  it('usa la cantidad real, en singular y plural', () => {
    expect(categorySubtitle(13)).toBe('13 categorías, ordenadas por volumen');
    expect(categorySubtitle(1)).toBe('1 categoría, ordenadas por volumen');
  });
});

describe('formatos', () => {
  it('cantidad con separador de miles en español', () => {
    expect(formatCount(35)).toBe('35');
    expect(formatCount(1234)).toBe('1.234');
  });

  it('porcentaje con coma, un decimal y espacio sin salto', () => {
    expect(formatPercent(9.3)).toBe('9,3 %');
    expect(formatPercent(100)).toBe('100,0 %');
  });
});

describe('buildCategoryRows', () => {
  const rows = buildCategoryRows([category('Red', 35), category('Acceso', 140), category('Pagos', 175)]);

  it('ordena de mayor a menor', () => {
    expect(rows.map((row) => row.category)).toEqual(['Pagos', 'Acceso', 'Red']);
  });

  it('el porcentaje es sobre el total del periodo', () => {
    expect(rows[0].percent).toBeCloseTo(50);
    expect(rows[2].percent).toBeCloseTo(10);
    expect(rows[2].percentText).toBe('10,0 %');
  });

  it('la barra se mide contra la categoria mayor, que ocupa todo el ancho', () => {
    expect(rows.map((row) => row.barPercent)).toEqual([100, 80, 20]);
  });

  it('cada fila se lee completa', () => {
    expect(rows[2].spoken).toBe('Red, 35 solicitudes, 10,0 por ciento del total');
    expect(buildCategoryRows([category('Red', 1)])[0].spoken).toBe('Red, 1 solicitud, 100,0 por ciento del total');
  });

  it('sin solicitudes no divide por cero', () => {
    const empty = buildCategoryRows([category('Red', 0)]);
    expect(empty[0].percent).toBe(0);
    expect(empty[0].barPercent).toBe(0);
  });

  it('sin categorias devuelve una lista vacia y no muta la entrada', () => {
    expect(buildCategoryRows([])).toEqual([]);
    const input = [category('B', 1), category('A', 2)];
    buildCategoryRows(input);
    expect(input[0].category).toBe('B');
  });
});

describe('lista recortada', () => {
  const many = buildCategoryRows(Array.from({ length: 13 }, (_, i) => category(`C${i}`, 100 - i)));

  it('con mas de 6 muestra las 6 primeras y se puede desplegar', () => {
    expect(isCategoryListFoldable(13)).toBe(true);
    expect(visibleCategoryRows(many, false)).toHaveLength(6);
    expect(visibleCategoryRows(many, true)).toHaveLength(13);
  });

  it('con 6 o menos no hay boton y se ven todas', () => {
    expect(isCategoryListFoldable(6)).toBe(false);
    expect(visibleCategoryRows(many.slice(0, 6), false)).toHaveLength(6);
  });

  it('texto del boton', () => {
    expect(categoryToggleLabel(13, false)).toBe('Ver las 13 categorías');
    expect(categoryToggleLabel(13, true)).toBe('Ver menos categorías');
  });
});
