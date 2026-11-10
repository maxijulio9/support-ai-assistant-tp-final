import { Observable, concatMap, from, map, of, switchMap, toArray } from 'rxjs';
import { InteractionListItem } from '../../../api/models/interaction-list-item';
import { InteractionsPage } from '../interactions.service';
import { InteractionFilters, filterInteractions, mergeInteractions } from '../case-grouping';
import { HistoryRange } from '../history-range';
import { EXPORT_PAGE_SIZE, EXPORT_ROW_LIMIT, pageLimitFor, planExportPages } from './history-export';

export interface ExportRequest {
  range: HistoryRange;
  filters: InteractionFilters;
}

export interface ExportCollection {
  items: InteractionListItem[];
  // Interacciones que cumplen estado y categoria en el periodo, sin tope
  total: number;
  capped: boolean;
}

export type FetchExportPage = (offset: number, limit: number) => Observable<InteractionsPage>;

// Pide el periodo por paginas: la primera dice el total, despues se piden las
// que faltan una por una (si una falla, falla todo y no queda un archivo a
// medias). Se une sin repetir por interaction_id, porque el orden por fecha
// no es unico y una interaccion nueva mueve los desplazamientos, y se aplican
// los filtros locales de la lista (incluida la busqueda, que el servidor no tiene).
export function collectExportItems(
  fetchPage: FetchExportPage,
  filters: InteractionFilters,
  pageSize: number = EXPORT_PAGE_SIZE,
  rowLimit: number = EXPORT_ROW_LIMIT,
): Observable<ExportCollection> {
  return fetchPage(0, pageSize).pipe(
    switchMap((first) => {
      const plan = planExportPages(first.total, pageSize, rowLimit);
      const rest = plan.offsets.slice(1);
      const others$ = rest.length === 0 ? of([] as InteractionsPage[]) : from(rest).pipe(concatMap((offset) => fetchPage(offset, pageLimitFor(offset, plan.target, pageSize))), toArray());

      return others$.pipe(
        map((pages) => {
          const merged = [first, ...pages].reduce<InteractionListItem[]>((all, page) => mergeInteractions(all, page.items), []);
          return {
            items: filterInteractions(merged, filters).slice(0, rowLimit),
            total: first.total,
            capped: plan.capped,
          };
        }),
      );
    }),
  );
}
