import { formatPercent } from './response-times-format';
import { buildStatsView, StatsView } from './stats-view';
import { OutcomeResponseTimes } from '../../../api/models/outcome-response-times';

const OUTCOME_ORDER = [
  'REVIEWED_APPROVED',
  'REVIEWED_EDITED',
  'REVIEWED_REGENERATED',
  'ESCALATED_BY_HUMAN',
  'DISCARDED_BY_HUMAN',
  'RESOLVED_EXTERNALLY',
];

const OUTCOME_LABELS: Record<string, string> = {
  REVIEWED_APPROVED: 'Aprobada',
  REVIEWED_EDITED: 'Editada y aprobada',
  REVIEWED_REGENERATED: 'Regenerada',
  ESCALATED_BY_HUMAN: 'Escalada por una persona',
  DISCARDED_BY_HUMAN: 'Descartada por una persona',
  RESOLVED_EXTERNALLY: 'Resuelta por fuera del sistema',
};

export const PENDING_OUTCOME_LABEL = 'Pendiente';

export const NO_MEASURED_FIRST_RESPONSE_TEXT = 'Sin primera respuesta medida';

export interface OutcomeRow {
  channel: string | null;
  label: string;
  tickets: number;
  ticketsText: string;
  // Proporcion de 0 a 1 sobre el total de tickets de la lista
  share: number;
  shareText: string;
  firstResponse: StatsView;
  // Lo que se muestra de la primera respuesta: la mediana, o el motivo por el
  // que no hay cifra
  firstResponseText: string;
}

// El estado sale solo de first_response.count, nunca del nombre del canal:
// hay canales sin hora medida del primer comentario (por ejemplo cuando una
// persona resolvio directo en JSM) y el backend lo expresa con count 0.
function firstResponseText(view: StatsView): string {
  if (view.state === 'empty') return NO_MEASURED_FIRST_RESPONSE_TEXT;
  if (view.state === 'insufficient') return `n insuficiente (${view.n} ${view.n === 1 ? 'ticket' : 'tickets'})`;
  return view.median === null ? 'Sin dato' : `Mediana ${view.median}`;
}

function orderOf(channel: string | null): number {
  if (channel === null) return Number.MAX_SAFE_INTEGER;
  const index = OUTCOME_ORDER.indexOf(channel);
  return index === -1 ? OUTCOME_ORDER.length : index;
}

// Orden fijo para los canales conocidos, los desconocidos despues (con su
// valor tal cual como rotulo) y los pendientes (null) al final.
export function buildOutcomeRows(outcomes: OutcomeResponseTimes[], minSample: number): OutcomeRow[] {
  const total = outcomes.reduce((sum, outcome) => sum + outcome.tickets, 0);

  return [...outcomes]
    .sort((a, b) => orderOf(a.resolution_channel) - orderOf(b.resolution_channel))
    .map((outcome) => {
      const channel = outcome.resolution_channel;
      const share = total === 0 ? 0 : outcome.tickets / total;
      const firstResponse = buildStatsView(outcome.first_response, minSample);
      return {
        channel,
        label: channel === null ? PENDING_OUTCOME_LABEL : (OUTCOME_LABELS[channel] ?? channel),
        tickets: outcome.tickets,
        ticketsText: `${outcome.tickets} ${outcome.tickets === 1 ? 'ticket' : 'tickets'}`,
        share,
        shareText: formatPercent(share),
        firstResponse,
        firstResponseText: firstResponseText(firstResponse),
      };
    });
}
