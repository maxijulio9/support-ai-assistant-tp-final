// Tipos locales que reflejan el contrato de tiempos de respuesta mientras el
// cliente generado no incluye el endpoint. Cuando llegue, este archivo se
// borra y los modulos importan los modelos de src/app/api.
export type CohortKey = 'automatic' | 'reviewed' | 'escalated' | 'info_requested' | 'baseline';
export type FirstResponseKind = 'answer' | 'acknowledgment' | 'information_request';
export type ClosureBasis = 'detected_confirmation' | 'last_customer_comment';

export interface StatsLike {
  count: number;
  mean_seconds: number | null;
  p50_seconds: number | null;
  p90_seconds: number | null;
  within_target_rate: number | null;
}

export interface OutcomeLike {
  resolution_channel: string | null;
  tickets: number;
  first_response: StatsLike;
}

export interface CategoryRowLike {
  category: string;
  tickets: number;
  first_response: StatsLike;
  closure: StatsLike;
}

export interface DailyPointLike {
  date: string;
  first_response: StatsLike;
}

export interface WeeklyPointLike {
  week_start: string;
  first_response: StatsLike;
}

export interface CohortLike {
  cohort: string;
  first_response_kind: string;
  closure_basis: string;
  tickets: number;
  first_response: StatsLike;
  closure: StatsLike;
  outcomes: OutcomeLike[];
  by_category: CategoryRowLike[];
  daily: DailyPointLike[];
  weekly: WeeklyPointLike[];
}

export interface ResponseTimesLike {
  timezone: string;
  min_sample: number;
  first_response_target_seconds: number | null;
  cohorts: CohortLike[];
}
