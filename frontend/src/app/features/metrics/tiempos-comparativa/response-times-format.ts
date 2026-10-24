const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;

// Hasta 59 s en segundos, desde 60 s en "X min Y s" y desde 1 h en
// "X h Y min". La parte en cero se omite ("2 min", "1 h"). Los segundos se
// redondean primero para que 3599,6 s no quede como "59 min 60 s".
export function formatDuration(seconds: number): string {
  const total = Math.round(seconds);
  if (total < SECONDS_PER_MINUTE) return `${total} s`;

  if (total < SECONDS_PER_HOUR) {
    const minutes = Math.floor(total / SECONDS_PER_MINUTE);
    const rest = total % SECONDS_PER_MINUTE;
    return rest === 0 ? `${minutes} min` : `${minutes} min ${rest} s`;
  }

  const hours = Math.floor(total / SECONDS_PER_HOUR);
  const minutes = Math.floor((total % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
}

// La tasa llega como fraccion de 0 a 1.
export function formatPercent(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

const COHORT_LABELS: Record<string, string> = {
  automatic: 'Automática',
  reviewed: 'Con revisión',
  escalated: 'Acuse de recibo',
  info_requested: 'Pedido de información',
  baseline: 'Atención manual previa',
};

// En tablas angostas baseline pasa a "Previa"; el resto ya es corto.
const COHORT_NARROW_LABELS: Record<string, string> = {
  ...COHORT_LABELS,
  baseline: 'Previa',
};

export function cohortLabel(cohort: string, narrow = false): string {
  const labels = narrow ? COHORT_NARROW_LABELS : COHORT_LABELS;
  return labels[cohort] ?? cohort;
}

const FIRST_RESPONSE_KIND_LABELS: Record<string, string> = {
  answer: 'Respuesta',
  acknowledgment: 'Acuse de recibo',
  information_request: 'Pedido de información',
};

export function firstResponseKindLabel(kind: string): string {
  return FIRST_RESPONSE_KIND_LABELS[kind] ?? kind;
}

// En escalated e info_requested la primera respuesta no es una solucion, por
// eso el rotulo aclara de que tipo es para que no se lea como resuelta.
export function withinTargetLabel(cohort: string): string {
  if (cohort === 'escalated') return 'dentro del objetivo (acuse)';
  if (cohort === 'info_requested') return 'dentro del objetivo (pedido)';
  return 'dentro del objetivo';
}
