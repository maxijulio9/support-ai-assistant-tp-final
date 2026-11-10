// Segundos de espera que indica el encabezado Retry-After de un 429. Solo se
// acepta un numero positivo: si falta, no es numerico (el encabezado tambien
// admite una fecha, que no se interpreta), o es 0 o negativo, no hay tiempo
// confiable que mostrar.
export function parseRetryAfterSeconds(header: string | null | undefined): number | null {
  if (header === null || header === undefined) return null;
  const text = header.trim();
  if (!/^-?\d+(\.\d+)?$/.test(text)) return null;
  const seconds = Number(text);
  return seconds > 0 ? seconds : null;
}

// minutes: siempre en minutos. auto: pasa a horas desde los 60 minutos.
export type RetryAfterUnits = 'minutes' | 'auto';

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

// Tiempo de espera legible ("1 minuto", "15 minutos", "1 hora"), redondeado
// hacia arriba y con minimo 1 minuto; null si no hay tiempo.
export function formatRetryAfter(seconds: number | null, units: RetryAfterUnits = 'minutes'): string | null {
  if (seconds === null || !(seconds > 0)) return null;
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  if (units === 'auto' && minutes >= 60) {
    return plural(Math.ceil(minutes / 60), 'hora', 'horas');
  }
  return plural(minutes, 'minuto', 'minutos');
}
