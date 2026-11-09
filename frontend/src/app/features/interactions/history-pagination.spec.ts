import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, paginateCases, parsePageSize } from './history-pagination';

const rows = (count: number) => Array.from({ length: count }, (_, index) => index + 1);

describe('parsePageSize', () => {
  it('las opciones son 10, 20 y 50, con 20 por defecto', () => {
    expect(PAGE_SIZE_OPTIONS).toEqual([10, 20, 50]);
    expect(DEFAULT_PAGE_SIZE).toBe(20);
  });

  it.each(['10', '20', '50', 10, 20, 50])('acepta %j', (value) => {
    expect(parsePageSize(value)).toBe(Number(value));
  });

  it.each([null, undefined, '', 'abc', '15', '0', '-10', '1e1', '20.5', '100', 7, Number.NaN])('%j se ignora y usa 20', (value) => {
    expect(parsePageSize(value)).toBe(20);
  });
});

describe('paginateCases', () => {
  it('la primera pagina trae las primeras filas segun el tamano', () => {
    const page = paginateCases(rows(67), 1, 20);

    expect(page.items).toEqual(rows(20));
    expect(page).toMatchObject({ page: 1, totalPages: 4, total: 67, from: 1, to: 20 });
  });

  it('la ultima pagina trae solo las que sobran', () => {
    const page = paginateCases(rows(67), 4, 20);

    expect(page.items).toEqual([61, 62, 63, 64, 65, 66, 67]);
    expect(page).toMatchObject({ from: 61, to: 67 });
  });

  it.each([
    [10, 7],
    [20, 4],
    [50, 2],
  ])('con %s por pagina hay %s paginas para 67 casos', (size, pages) => {
    expect(paginateCases(rows(67), 1, size).totalPages).toBe(pages);
  });

  it('un total justo no deja una pagina de mas', () => {
    expect(paginateCases(rows(40), 2, 20).totalPages).toBe(2);
    expect(paginateCases(rows(40), 2, 20).items).toEqual(rows(40).slice(20));
  });

  it('una pagina fuera de rango vuelve a la primera', () => {
    expect(paginateCases(rows(67), 99, 20).page).toBe(1);
    expect(paginateCases(rows(67), 0, 20).page).toBe(1);
    expect(paginateCases(rows(67), -1, 20).page).toBe(1);
    expect(paginateCases(rows(67), 1.5, 20).page).toBe(1);
    expect(paginateCases(rows(67), Number.NaN, 20).page).toBe(1);
  });

  it('al agrandar el tamano, la pagina que ya no existe vuelve a la primera', () => {
    expect(paginateCases(rows(67), 5, 20).page).toBe(1);
    expect(paginateCases(rows(67), 5, 10).page).toBe(5);
    expect(paginateCases(rows(67), 5, 50).page).toBe(1);
  });

  it('sin casos queda una pagina vacia', () => {
    expect(paginateCases([], 1, 20)).toMatchObject({ items: [], page: 1, totalPages: 1, total: 0, from: 0, to: 0 });
  });

  it('un tamano invalido se trata como 20', () => {
    expect(paginateCases(rows(67), 1, 15).items).toHaveLength(20);
  });

  it('recorrer todas las paginas devuelve cada caso una sola vez', () => {
    for (const size of PAGE_SIZE_OPTIONS) {
      const first = paginateCases(rows(103), 1, size);
      const seen = Array.from({ length: first.totalPages }, (_, index) => paginateCases(rows(103), index + 1, size).items).flat();

      expect(seen).toEqual(rows(103));
    }
  });

  it('no modifica la lista original', () => {
    const original = rows(30);
    paginateCases(original, 2, 10);

    expect(original).toEqual(rows(30));
  });
});
