const TIME_FORMATTER = new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const DAY_MONTH_FORMATTER = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' });
const DAY_MONTH_YEAR_FORMATTER = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric' });

const MINUTE_MS = 60 * 1000;

// "hoy" y "ayer" se miden por dia calendario en la zona del navegador, no por
// horas transcurridas: lo de anoche a las 21:57 es "ayer" aunque hayan pasado
// pocas horas. "now" se recibe por parametro para poder fijar el reloj.
export function formatRelativeTime(value: string | null | undefined, now: Date = new Date()): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  // Una fecha apenas en el futuro (reloj desfasado) tambien es "un momento"
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < MINUTE_MS) return 'hace un momento';

  const minutes = Math.floor(diffMs / MINUTE_MS);
  if (minutes < 60) return `hace ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`;

  const time = TIME_FORMATTER.format(date);
  const dayOffset = calendarDaysBetween(date, now);
  if (dayOffset === 0) return `hoy, ${time}`;
  if (dayOffset === 1) return `ayer, ${time}`;

  const day = (date.getFullYear() === now.getFullYear() ? DAY_MONTH_FORMATTER : DAY_MONTH_YEAR_FORMATTER).format(date);
  return `${day}, ${time}`;
}

// Dias de calendario entre dos fechas. Se compara el dia local (anio, mes,
// dia) con Date.UTC para que un cambio de horario de verano no corra la cuenta.
function calendarDaysBetween(earlier: Date, later: Date): number {
  const start = Date.UTC(earlier.getFullYear(), earlier.getMonth(), earlier.getDate());
  const end = Date.UTC(later.getFullYear(), later.getMonth(), later.getDate());
  return Math.round((end - start) / (24 * 60 * 60 * 1000));
}
