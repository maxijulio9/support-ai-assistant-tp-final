import { CategoryMetric } from '../../api/models/category-metric';

// Cuantas categorias se ven antes de desplegar el resto
export const CATEGORY_VISIBLE_COUNT = 6;

const COUNT_FORMAT = new Intl.NumberFormat('es-AR');
const PERCENT_FORMAT = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
// Espacio sin salto: la cifra y el simbolo no se separan en dos lineas
const NBSP = ' ';

export interface CategoryRow {
  category: string;
  total: number;
  // Parte del total del periodo, de 0 a 100
  percent: number;
  // Ancho de la barra, de 0 a 100, medido contra la categoria de mayor volumen
  barPercent: number;
  totalText: string;
  percentText: string;
  // Lectura completa de la fila para lectores de pantalla
  spoken: string;
}

export function categorySubtitle(count: number): string {
  return `${count} ${count === 1 ? 'categoría' : 'categorías'}, ordenadas por volumen`;
}

export function formatCount(value: number): string {
  return COUNT_FORMAT.format(value);
}

export function formatPercent(value: number): string {
  return `${PERCENT_FORMAT.format(value)}${NBSP}%`;
}

// Filas ordenadas de mayor a menor volumen. El porcentaje es sobre el total
// del periodo; la barra se mide contra la primera (la mayor), que ocupa todo
// el ancho de la pista, para que se puedan comparar entre si.
export function buildCategoryRows(categories: readonly CategoryMetric[]): CategoryRow[] {
  const sorted = [...categories].sort((a, b) => b.total_interactions - a.total_interactions);
  const total = sorted.reduce((sum, category) => sum + category.total_interactions, 0);
  const largest = sorted[0]?.total_interactions ?? 0;

  return sorted.map((category) => {
    const count = category.total_interactions;
    const percent = total > 0 ? (count / total) * 100 : 0;
    const percentText = formatPercent(percent);
    return {
      category: category.category,
      total: count,
      percent,
      barPercent: largest > 0 ? (count / largest) * 100 : 0,
      totalText: formatCount(count),
      percentText,
      spoken: `${category.category}, ${formatCount(count)} ${count === 1 ? 'solicitud' : 'solicitudes'}, ${PERCENT_FORMAT.format(percent)} por ciento del total`,
    };
  });
}

// Con seis o menos no hay nada que desplegar
export function isCategoryListFoldable(count: number): boolean {
  return count > CATEGORY_VISIBLE_COUNT;
}

export function visibleCategoryRows(rows: readonly CategoryRow[], expanded: boolean): CategoryRow[] {
  return expanded || !isCategoryListFoldable(rows.length) ? [...rows] : rows.slice(0, CATEGORY_VISIBLE_COUNT);
}

export function categoryToggleLabel(count: number, expanded: boolean): string {
  return expanded ? 'Ver menos categorías' : `Ver las ${count} categorías`;
}
