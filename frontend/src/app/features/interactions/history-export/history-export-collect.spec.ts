import { Observable, of, throwError } from 'rxjs';
import { InteractionListItem } from '../../../api/models/interaction-list-item';
import { InteractionsPage } from '../interactions.service';
import { ExportCollection, collectExportItems } from './history-export-collect';

const NO_FILTERS = { term: '', status: null, category: null };

function row(id: number, overrides: Partial<InteractionListItem> = {}): InteractionListItem {
  return {
    interaction_id: `id-${id}`,
    issue_key: `K-${id}`,
    summary: `Asunto ${id}`,
    category: 'Red',
    priority: null,
    decision: 'AUTO_PUBLISH',
    system_decision: 'AUTO_PUBLISH',
    resolution_channel: null,
    confidence_score: null,
    ticket_url: null,
    was_edited: false,
    created_at: new Date(2026, 10, 9, 12, 0, 0, 1000 - id).toISOString(),
    responded_at: null,
    ...overrides,
  };
}

// Servidor simulado: total filas, paginas por limit y offset, con un registro de pedidos
function fakeServer(total: number, build: (id: number) => InteractionListItem = row) {
  const calls: { offset: number; limit: number }[] = [];
  const fetchPage = (offset: number, limit: number): Observable<InteractionsPage> => {
    calls.push({ offset, limit });
    const items = Array.from({ length: Math.max(0, Math.min(limit, total - offset)) }, (_, index) => build(offset + index + 1));
    return of({ items, total });
  };
  return { calls, fetchPage };
}

describe('collectExportItems', () => {
  it('pide las paginas con limit y offset hasta llegar al total', () => {
    const server = fakeServer(842);
    let result: ExportCollection | undefined;
    collectExportItems(server.fetchPage, NO_FILTERS, 500, 1000).subscribe((value) => (result = value));

    expect(server.calls).toEqual([
      { offset: 0, limit: 500 },
      { offset: 500, limit: 342 },
    ]);
    expect(result?.items).toHaveLength(842);
    expect(result?.total).toBe(842);
    expect(result?.capped).toBe(false);
  });

  it('el tope se respeta aunque no sea multiplo del tamaño de pagina: la ultima pide solo lo que falta', () => {
    const server = fakeServer(5000);
    let result: ExportCollection | undefined;
    collectExportItems(server.fetchPage, NO_FILTERS, 400, 1000).subscribe((value) => (result = value));

    expect(server.calls).toEqual([
      { offset: 0, limit: 400 },
      { offset: 400, limit: 400 },
      { offset: 800, limit: 200 },
    ]);
    expect(result?.items).toHaveLength(1000);
  });

  it('con una sola pagina no pide mas', () => {
    const server = fakeServer(37);
    collectExportItems(server.fetchPage, NO_FILTERS).subscribe();

    expect(server.calls).toHaveLength(1);
  });

  it('sin interacciones devuelve vacio', () => {
    const server = fakeServer(0);
    let result: { items: unknown[]; capped: boolean } | undefined;
    collectExportItems(server.fetchPage, NO_FILTERS).subscribe((value) => (result = value));

    expect(result).toEqual({ items: [], total: 0, capped: false });
  });

  it('por encima del tope pide solo las paginas necesarias y avisa', () => {
    const server = fakeServer(6200);
    let result: { items: unknown[]; capped: boolean; total: number } | undefined;
    collectExportItems(server.fetchPage, NO_FILTERS, 500, 1000).subscribe((value) => (result = value));

    expect(server.calls).toEqual([
      { offset: 0, limit: 500 },
      { offset: 500, limit: 500 },
    ]);
    expect(result?.items).toHaveLength(1000);
    expect(result?.capped).toBe(true);
    expect(result?.total).toBe(6200);
  });

  it('no repite una interaccion que llega en dos paginas', () => {
    const repeated = (id: number) => row(id === 501 ? 500 : id);
    const server = fakeServer(600, repeated);
    let result: { items: InteractionListItem[] } | undefined;
    collectExportItems(server.fetchPage, NO_FILTERS, 500, 1000).subscribe((value) => (result = value));

    expect(result?.items).toHaveLength(599);
    expect(new Set(result?.items.map((entry) => entry.interaction_id)).size).toBe(599);
  });

  it('aplica los filtros locales: busqueda, estado y categoria', () => {
    const server = fakeServer(30, (id) => row(id, { decision: id % 2 ? 'ESCALATE' : 'AUTO_PUBLISH', category: id % 3 ? 'Red' : 'Acceso', summary: id === 7 ? 'No anda la VPN' : `Asunto ${id}` }));
    const run = (filters: { term: string; status: string | null; category: string | null }) => {
      let items: InteractionListItem[] = [];
      collectExportItems(server.fetchPage, filters).subscribe((value) => (items = value.items));
      return items;
    };

    expect(run({ term: 'vpn', status: null, category: null }).map((entry) => entry.issue_key)).toEqual(['K-7']);
    expect(run({ term: '', status: 'ESCALATE', category: null })).toHaveLength(15);
    expect(run({ term: '', status: 'ESCALATE', category: 'Acceso' }).every((entry) => entry.category === 'Acceso')).toBe(true);
  });

  it('si una pagina falla, falla todo', () => {
    let error: unknown;
    const fetchPage = (offset: number, limit: number): Observable<InteractionsPage> =>
      offset === 500 ? throwError(() => new Error('pagina 2')) : of({ items: Array.from({ length: limit }, (_, index) => row(offset + index + 1)), total: 1200 });
    collectExportItems(fetchPage, NO_FILTERS, 500, 1000).subscribe({ error: (value) => (error = value) });

    expect((error as Error).message).toBe('pagina 2');
  });

  it('si falla la primera pagina tambien', () => {
    let failed = false;
    collectExportItems(() => throwError(() => new Error('x')), NO_FILTERS).subscribe({ error: () => (failed = true) });

    expect(failed).toBe(true);
  });
});
