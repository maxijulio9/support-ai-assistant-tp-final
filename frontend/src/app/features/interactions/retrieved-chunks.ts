import { InteractionSource } from '../../api/models/interaction-source';
import { RetrievedChunkDetail } from '../../api/models/retrieved-chunk-detail';
import { hasFragment, isFragmentCollapsible, sourceLinkUrl, sourceSpaceLabel } from './interaction-sources';

export const CHUNKS_TITLE = 'Fragmentos recuperados';
export const CHUNKS_NOTE =
  'Fragmentos recuperados por la búsqueda semántica. El sistema no registra cuáles usó el modelo en la respuesta.';
export const UNTITLED_PAGE = 'Página sin título';

const similarityFormat = new Intl.NumberFormat('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Similitud con dos decimales ("0,87"); un valor ilegible queda vacio
export function similarityText(score: number | null | undefined): string | null {
  if (score === null || score === undefined || !Number.isFinite(score)) return null;
  return similarityFormat.format(score);
}

export interface RetrievedRow {
  key: string;
  title: string;
  // null en una fuente que no aparece entre los fragmentos recuperados
  similarity: string | null;
  href: string | null;
  space: string | null;
  fragment: string | null;
  collapsible: boolean;
  // El fragmento de esta pagina ya se muestra en una fila anterior: no se repite ni se marca como faltante
  fragmentShownAbove: boolean;
}

const normalize = (title: string | null | undefined) => title?.trim().toLowerCase() ?? '';

// Los fragmentos vienen con titulo, ranking y similitud; el texto y el enlace
// vienen en sources, una por pagina. Se cruzan por titulo de pagina: el
// fragmento de una pagina se muestra en su fragmento mejor posicionado y los
// demas de la misma pagina solo traen titulo y similitud. Las fuentes sin
// fragmento recuperado se agregan al final. Sin fragmentos recuperados, solo
// se listan las fuentes.
export function buildRetrievedRows(
  chunks: readonly RetrievedChunkDetail[],
  sources: readonly InteractionSource[],
): RetrievedRow[] {
  const byTitle = new Map<string, InteractionSource>();
  for (const source of sources) {
    const key = normalize(source.page_title);
    if (!byTitle.has(key)) byTitle.set(key, source);
  }

  const rowFrom = (key: string, title: string, similarity: string | null, source: InteractionSource | undefined, shownAbove: boolean): RetrievedRow => ({
    key,
    title,
    similarity,
    href: shownAbove || !source ? null : sourceLinkUrl(source.url),
    space: shownAbove || !source ? null : sourceSpaceLabel(source.space_key),
    fragment: shownAbove || !source || !hasFragment(source.fragment) ? null : source.fragment,
    collapsible: !shownAbove && !!source && isFragmentCollapsible(source.fragment),
    fragmentShownAbove: shownAbove,
  });

  const used = new Set<string>();
  const rows: RetrievedRow[] = [];

  [...chunks]
    .sort((a, b) => a.rank_position - b.rank_position)
    .forEach((chunk, index) => {
      const titleKey = normalize(chunk.page_title);
      const source = titleKey ? byTitle.get(titleKey) : undefined;
      const shownAbove = titleKey !== '' && used.has(titleKey);
      if (titleKey) used.add(titleKey);
      rows.push(rowFrom(`c${index}`, chunk.page_title?.trim() || UNTITLED_PAGE, similarityText(chunk.similarity_score), source, shownAbove));
    });

  sources.forEach((source, index) => {
    const titleKey = normalize(source.page_title);
    if (used.has(titleKey)) return;
    used.add(titleKey);
    rows.push(rowFrom(`s${index}`, source.page_title, null, source, false));
  });

  return rows;
}
