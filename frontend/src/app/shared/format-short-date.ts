const TIME_FORMATTER = new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const DAY_MONTH_FORMATTER = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' });
const DAY_MONTH_YEAR_FORMATTER = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric' });

// Fecha corta con hora ("5 oct, 21:57"). El año solo aparece si no es el
// actual ("5 oct 2025, 21:57"). "now" se recibe por parametro para poder fijar el reloj.
export function formatShortDate(value: string | null | undefined, now: Date = new Date()): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const day = (date.getFullYear() === now.getFullYear() ? DAY_MONTH_FORMATTER : DAY_MONTH_YEAR_FORMATTER).format(date);
  return `${day}, ${TIME_FORMATTER.format(date)}`;
}
