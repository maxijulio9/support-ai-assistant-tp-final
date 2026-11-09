import { pageRangeText, paginate } from './category-pagination';

const rows = (count: number) => Array.from({ length: count }, (_, index) => index + 1);

describe('paginate', () => {
  it('la primera pagina trae las primeras filas en el mismo orden', () => {
    const page = paginate(rows(14), 1, 6);

    expect(page.items).toEqual([1, 2, 3, 4, 5, 6]);
    expect(page).toMatchObject({ page: 1, totalPages: 3, total: 14, from: 1, to: 6, hasPrevious: false, hasNext: true });
  });

  it('la ultima pagina trae solo las que sobran', () => {
    const page = paginate(rows(14), 3, 6);

    expect(page.items).toEqual([13, 14]);
    expect(page).toMatchObject({ from: 13, to: 14, hasPrevious: true, hasNext: false });
  });

  it('con un total justo no hay pagina de mas', () => {
    const page = paginate(rows(12), 2, 6);

    expect(page.totalPages).toBe(2);
    expect(page.items).toEqual([7, 8, 9, 10, 11, 12]);
  });

  it('una pagina fuera de rango se recorta al rango valido', () => {
    expect(paginate(rows(14), 99, 6).page).toBe(3);
    expect(paginate(rows(14), 0, 6).page).toBe(1);
    expect(paginate(rows(14), -4, 6).page).toBe(1);
    expect(paginate(rows(14), Number.NaN, 6).page).toBe(1);
  });

  it('sin filas queda una pagina vacia sin botones', () => {
    const page = paginate([], 1, 6);

    expect(page).toMatchObject({ items: [], page: 1, totalPages: 1, total: 0, from: 0, to: 0, hasPrevious: false, hasNext: false });
  });

  it('menos filas que el tamano de pagina entran en una sola', () => {
    const page = paginate(rows(4), 1, 6);

    expect(page.items).toEqual([1, 2, 3, 4]);
    expect(page.hasNext).toBe(false);
  });

  it('un tamano invalido se trata como 1', () => {
    expect(paginate(rows(3), 2, 0).items).toEqual([2]);
  });

  it('no modifica la lista original', () => {
    const original = rows(8);
    paginate(original, 2, 3);

    expect(original).toEqual(rows(8));
  });

  it('recorrer todas las paginas devuelve cada fila una sola vez', () => {
    const all = rows(23);
    const first = paginate(all, 1, 6);
    const seen = Array.from({ length: first.totalPages }, (_, index) => paginate(all, index + 1, 6).items).flat();

    expect(seen).toEqual(all);
  });
});

describe('pageRangeText', () => {
  it('arma el rango con el total', () => {
    expect(pageRangeText(paginate(rows(14), 2, 6))).toBe('7-12 de 14 categorías');
  });

  it('con una sola va en singular', () => {
    expect(pageRangeText(paginate(rows(1), 1, 6))).toBe('1-1 de 1 categoría');
  });

  it('sin filas dice 0-0', () => {
    expect(pageRangeText(paginate([], 1, 6))).toBe('0-0 de 0 categorías');
  });
});
