import { resolveSegmentColorVar } from '../../../shared/decision-colors';
import { cohortDescription, cohortLabel, firstResponseKindLabel, formatPercent, withinTargetLabel } from './response-times-format';
import { closureBasisText, closurePlaceholder } from './closure';
import { buildStatsView, StatsView } from './stats-view';
import { CohortLike, ResponseTimesLike } from './response-times.types';

export interface WithinTarget {
  text: string;
  label: string;
}

export interface CohortPlaceholder {
  title: string;
  detail: string;
}

export interface CohortClosure {
  view: StatsView;
  // Reemplaza a las cifras cuando no hay con que calcularlas
  placeholder: string | null;
  // Como se mide el cierre de esta cohorte, segun su closure_basis
  basisText: string;
}

export interface CohortCard {
  key: string;
  label: string;
  description: string;
  // Variable CSS del color de decision que identifica a la cohorte
  accentVar: string;
  kindLabel: string;
  // Tickets de la cohorte, incluidos los que no tienen dato de tiempo
  tickets: number;
  firstResponse: StatsView;
  // Cantidad de tickets con tiempo, y de cuantos en total si difieren
  ticketsText: string;
  // Reemplaza a las cifras cuando no hay con que calcularlas
  placeholder: CohortPlaceholder | null;
  withinTarget: WithinTarget | null;
  closure: CohortClosure;
}

const ACCENT_DECISION_KEY: Record<string, string> = {
  automatic: 'AUTO_PUBLISH',
  reviewed: 'NEEDS_REVIEW',
  escalated: 'ESCALATE',
  info_requested: 'REQUEST_INFO',
};

// Reusa los colores de decision del resto de Metricas. La atencion manual
// previa no es una decision del sistema, asi que toma el color neutro.
export function cohortAccentVar(cohort: string): string {
  return resolveSegmentColorVar(ACCENT_DECISION_KEY[cohort] ?? 'OTHER');
}

function ticketsWord(count: number): string {
  return count === 1 ? 'ticket' : 'tickets';
}

export function cohortPlaceholder(view: StatsView, tickets: number, minSample: number): CohortPlaceholder | null {
  if (view.state === 'insufficient') {
    return {
      title: 'n insuficiente',
      detail: `Hay ${view.n} ${ticketsWord(view.n)} con tiempo de respuesta y hacen falta al menos ${minSample} para calcular los tiempos.`,
    };
  }
  if (view.state === 'empty' && tickets === 0) {
    return { title: 'Sin tickets', detail: 'No hay tickets en este grupo con los filtros elegidos.' };
  }
  if (view.state === 'empty') {
    return {
      title: 'Sin datos de tiempo',
      detail: `Hay ${tickets} ${ticketsWord(tickets)}, pero ninguno con primera respuesta registrada.`,
    };
  }
  return null;
}

export function cohortTicketsText(view: StatsView, tickets: number): string {
  return view.n === tickets ? String(view.n) : `${view.n} con tiempo (de ${tickets})`;
}

function buildCohortClosure(cohort: CohortLike, minSample: number): CohortClosure {
  const view = buildStatsView(cohort.closure, minSample);
  return {
    view,
    placeholder: closurePlaceholder(view, cohort.tickets),
    basisText: closureBasisText(cohort.closure_basis),
  };
}

// El porcentaje dentro del objetivo solo se muestra si hay objetivo (hay
// proyecto elegido), el backend lo calculo y la muestra alcanza.
export function buildCohortCard(cohort: CohortLike, minSample: number, targetSeconds: number | null): CohortCard {
  const firstResponse = buildStatsView(cohort.first_response, minSample);
  const rate = cohort.first_response.within_target_rate;
  const showTarget = targetSeconds !== null && rate !== null && firstResponse.state === 'ok';

  return {
    key: cohort.cohort,
    label: cohortLabel(cohort.cohort),
    description: cohortDescription(cohort.cohort),
    accentVar: cohortAccentVar(cohort.cohort),
    kindLabel: firstResponseKindLabel(cohort.first_response_kind),
    tickets: cohort.tickets,
    firstResponse,
    ticketsText: cohortTicketsText(firstResponse, cohort.tickets),
    placeholder: cohortPlaceholder(firstResponse, cohort.tickets, minSample),
    withinTarget: showTarget ? { text: formatPercent(rate), label: withinTargetLabel(cohort.cohort) } : null,
    closure: buildCohortClosure(cohort, minSample),
  };
}

// Las cinco cohortes vienen siempre; solo se separan por rol en pantalla.
export const MAIN_COHORTS: readonly string[] = ['automatic', 'reviewed', 'baseline'];
export const SYSTEM_RESPONSE_COHORTS: readonly string[] = ['escalated', 'info_requested'];

export function pickCohorts(cohorts: CohortLike[], keys: readonly string[]): CohortLike[] {
  return keys.flatMap((key) => cohorts.filter((cohort) => cohort.cohort === key));
}

// Sin tickets en ninguna cohorte la pantalla muestra un estado vacio.
export function hasAnyTickets(data: ResponseTimesLike): boolean {
  return data.cohorts.some((cohort) => cohort.tickets > 0);
}
