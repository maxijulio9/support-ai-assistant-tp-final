import { formatPercent } from './response-times-format';
import { buildStatsView, StatsView } from './stats-view';
import { OutcomeLike } from './response-times.types';

const OUTCOME_ORDER = [
  'REVIEWED_APPROVED',
  'REVIEWED_EDITED',
  'REVIEWED_REGENERATED',
  'ESCALATED_BY_HUMAN',
  'DISCARDED_BY_HUMAN',
];

const OUTCOME_LABELS: Record<string, string> = {
  REVIEWED_APPROVED: 'Aprobada',
  REVIEWED_EDITED: 'Editada y aprobada',
  REVIEWED_REGENERATED: 'Regenerada',
  ESCALATED_BY_HUMAN: 'Escalada por una persona',
  DISCARDED_BY_HUMAN: 'Descartada por una persona',
};

export const PENDING_OUTCOME_LABEL = 'Pendiente';

// Estos dos canales cierran la solicitud sin publicar una respuesta, asi que
// no tienen primera respuesta.
const WITHOUT_FIRST_RESPONSE = new Set(['ESCALATED_BY_HUMAN', 'DISCARDED_BY_HUMAN']);

export const NO_FIRST_RESPONSE_TEXT = 'Sin primera respuesta';

export interface OutcomeRow {
  channel: string | null;
  label: string;
  tickets: number;
  ticketsText: string;
  // Proporcion de 0 a 1 sobre el total de tickets de la lista
  share: number;
  shareText: string;
  hasFirstResponse: boolean;
  firstResponse: StatsView | null;
  // Lo que se muestra de la primera respuesta: la mediana, o el motivo por el
  // que no hay cifra
  firstResponseText: string;
}

function firstResponseText(view: StatsView | null): string {
  if (view === null) return NO_FIRST_RESPONSE_TEXT;
  if (view.state === 'insufficient') return 'n insuficiente';
  if (view.state === 'empty') return 'Sin datos de tiempo';
  return view.median === null ? 'Sin dato' : `Mediana ${view.median}`;
}

function orderOf(channel: string | null): number {
  if (channel === null) return Number.MAX_SAFE_INTEGER;
  const index = OUTCOME_ORDER.indexOf(channel);
  return index === -1 ? OUTCOME_ORDER.length : index;
}

// Orden fijo para los canales conocidos, los desconocidos despues (con su
// valor tal cual como rotulo) y los pendientes (null) al final.
export function buildOutcomeRows(outcomes: OutcomeLike[], minSample: number): OutcomeRow[] {
  const total = outcomes.reduce((sum, outcome) => sum + outcome.tickets, 0);

  return [...outcomes]
    .sort((a, b) => orderOf(a.resolution_channel) - orderOf(b.resolution_channel))
    .map((outcome) => {
      const channel = outcome.resolution_channel;
      const hasFirstResponse = channel === null || !WITHOUT_FIRST_RESPONSE.has(channel);
      const share = total === 0 ? 0 : outcome.tickets / total;
      const firstResponse = hasFirstResponse ? buildStatsView(outcome.first_response, minSample) : null;
      return {
        channel,
        label: channel === null ? PENDING_OUTCOME_LABEL : (OUTCOME_LABELS[channel] ?? channel),
        tickets: outcome.tickets,
        ticketsText: `${outcome.tickets} ${outcome.tickets === 1 ? 'ticket' : 'tickets'}`,
        share,
        shareText: formatPercent(share),
        hasFirstResponse,
        firstResponse,
        firstResponseText: firstResponseText(firstResponse),
      };
    });
}
