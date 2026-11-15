import { InteractionSource } from '../../api/models/interaction-source';
import { RetrievedChunkDetail } from '../../api/models/retrieved-chunk-detail';
import { buildRetrievedRows, similarityText } from './retrieved-chunks';

const chunk = (title: string | null, rank: number, score: number): RetrievedChunkDetail => ({ page_title: title, rank_position: rank, similarity_score: score });
const source = (title: string, overrides: Partial<InteractionSource> = {}): InteractionSource => ({
  page_title: title,
  space_key: 'KB',
  url: 'https://wiki.example.com/p/1',
  fragment: 'Texto de la pagina',
  ...overrides,
});

describe('similarityText', () => {
  it('usa dos decimales', () => {
    expect(similarityText(0.8712)).toBe('0,87');
    expect(similarityText(1)).toBe('1,00');
    expect(similarityText(0.5)).toBe('0,50');
  });

  it('un valor ilegible queda vacio', () => {
    expect(similarityText(null)).toBeNull();
    expect(similarityText(undefined)).toBeNull();
    expect(similarityText(Number.NaN)).toBeNull();
  });
});

describe('buildRetrievedRows', () => {
  it('cruza cada fragmento con su fuente por titulo y ordena por ranking', () => {
    const rows = buildRetrievedRows([chunk('Guia B', 2, 0.61), chunk('Guia A', 1, 0.87)], [source('Guia A'), source('Guia B', { url: null, fragment: null })]);
    expect(rows.map((row) => [row.title, row.similarity])).toEqual([
      ['Guia A', '0,87'],
      ['Guia B', '0,61'],
    ]);
    expect(rows[0].href).toBe('https://wiki.example.com/p/1');
    expect(rows[0].space).toBe('Espacio KB');
    expect(rows[0].fragment).toBe('Texto de la pagina');
    expect(rows[1].href).toBeNull();
    expect(rows[1].fragment).toBeNull();
    expect(rows[1].fragmentShownAbove).toBe(false);
  });

  it('el cruce ignora mayusculas y espacios sobrantes', () => {
    const rows = buildRetrievedRows([chunk('  guia a ', 1, 0.9)], [source('Guia A')]);
    expect(rows[0].fragment).toBe('Texto de la pagina');
  });

  it('varios fragmentos de la misma pagina muestran el texto una sola vez', () => {
    const rows = buildRetrievedRows([chunk('Guia A', 1, 0.9), chunk('Guia A', 2, 0.8)], [source('Guia A')]);
    expect(rows[0].fragment).not.toBeNull();
    expect(rows[1].fragment).toBeNull();
    expect(rows[1].href).toBeNull();
    expect(rows[1].fragmentShownAbove).toBe(true);
    expect(rows[1].similarity).toBe('0,80');
  });

  it('un fragmento sin fuente no inventa enlace ni texto', () => {
    const rows = buildRetrievedRows([chunk('Pagina borrada', 1, 0.7)], []);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ title: 'Pagina borrada', href: null, fragment: null, fragmentShownAbove: false });
  });

  it('un fragmento sin titulo usa un texto fijo y no se cruza', () => {
    const rows = buildRetrievedRows([chunk(null, 1, 0.7)], [source('Guia A')]);
    expect(rows[0].title).toBe('Página sin título');
    expect(rows[0].fragment).toBeNull();
    expect(rows[1].title).toBe('Guia A');
  });

  it('las fuentes sin fragmento recuperado se agregan al final, sin similitud', () => {
    const rows = buildRetrievedRows([chunk('Guia A', 1, 0.9)], [source('Guia A'), source('Guia C')]);
    expect(rows.map((row) => row.title)).toEqual(['Guia A', 'Guia C']);
    expect(rows[1].similarity).toBeNull();
    expect(rows[1].fragment).toBe('Texto de la pagina');
  });

  it('sin fragmentos recuperados lista solo las fuentes', () => {
    const rows = buildRetrievedRows([], [source('Guia A'), source('Guia B')]);
    expect(rows.map((row) => row.title)).toEqual(['Guia A', 'Guia B']);
    expect(rows.every((row) => row.similarity === null)).toBe(true);
  });

  it('un enlace con usuario embebido no se usa', () => {
    const rows = buildRetrievedRows([chunk('Guia A', 1, 0.9)], [source('Guia A', { url: 'https://user:clave@wiki.example.com/p' })]);
    expect(rows[0].href).toBeNull();
  });

  it('no modifica las listas que recibe', () => {
    const chunks = [chunk('B', 2, 0.5), chunk('A', 1, 0.9)];
    buildRetrievedRows(chunks, []);
    expect(chunks.map((c) => c.page_title)).toEqual(['B', 'A']);
  });
});
