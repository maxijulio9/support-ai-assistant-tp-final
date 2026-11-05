import { parseIsoDateLocal } from '../features/dashboard/period';

const SHORT_DAY_FORMATTER = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' });

// No reusa formatShortDate: esa incluye hora y minuto, pensada para
// timestamps, y aca el valor es un dia AAAA-MM-DD sin hora.
export function formatShortDay(day: string): string {
  return SHORT_DAY_FORMATTER.format(parseIsoDateLocal(day));
}
