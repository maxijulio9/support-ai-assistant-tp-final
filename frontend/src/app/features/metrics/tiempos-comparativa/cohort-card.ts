import { cohortLabel, firstResponseKindLabel, formatPercent, withinTargetLabel } from './response-times-format';
import { buildStatsView, StatsView } from './stats-view';
import { CohortLike } from './response-times.types';

export interface WithinTarget {
  text: string;
  label: string;
}

export interface CohortCard {
  key: string;
  label: string;
  kindLabel: string;
  // Tickets de la cohorte, incluidos los que no tienen dato de tiempo
  tickets: number;
  firstResponse: StatsView;
  withinTarget: WithinTarget | null;
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
    kindLabel: firstResponseKindLabel(cohort.first_response_kind),
    tickets: cohort.tickets,
    firstResponse,
    withinTarget: showTarget ? { text: formatPercent(rate), label: withinTargetLabel(cohort.cohort) } : null,
  };
}

// Las cinco cohortes vienen siempre; solo se separan por rol en pantalla.
export const MAIN_COHORTS: readonly string[] = ['automatic', 'reviewed', 'baseline'];
export const SYSTEM_RESPONSE_COHORTS: readonly string[] = ['escalated', 'info_requested'];

export function pickCohorts(cohorts: CohortLike[], keys: readonly string[]): CohortLike[] {
  return keys.flatMap((key) => cohorts.filter((cohort) => cohort.cohort === key));
}
