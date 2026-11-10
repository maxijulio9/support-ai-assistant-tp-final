import { isValidIsoDate, toIsoDate } from '../dashboard/period';

// Rango de dias del Historial, en formato AAAA-MM-DD.
export interface HistoryRange {
  from: string;
  to: string;
}

// GET /api/interactions compara from_date y to_date tal cual contra
// created_at (TIMESTAMPTZ), con >= y <=, y no recibe huso horario. Un
// "2026-11-05" suelto se leeria como medianoche en el huso de la base y
// "hasta" dejaria afuera el ultimo dia. Por eso se mandan instantes con el
// desplazamiento de Argentina (UTC-3 todo el año, sin horario de verano):
// el dia calendario argentino queda completo, de 00:00:00 a 23:59:59.999999.
export const HISTORY_UTC_OFFSET = '-03:00';

export function dayStartInstant(day: string): string {
  return `${day}T00:00:00${HISTORY_UTC_OFFSET}`;
}

export function dayEndInstant(day: string): string {
  return `${day}T23:59:59.999999${HISTORY_UTC_OFFSET}`;
}

// Parametros de la consulta para un rango; sin rango no se manda ninguno
export function rangeApiParams(range: HistoryRange | null): { from_date?: string; to_date?: string } {
  if (range === null) return {};
  return { from_date: dayStartInstant(range.from), to_date: dayEndInstant(range.to) };
}

// Un rango vale si los dos extremos estan, son fechas calendario reales, no
// son futuras y desde no es mayor que hasta. Si no, es null (sin rango).
// today se recibe por parametro para poder fijar el reloj.
export function resolveHistoryRange(
  from: string | null | undefined,
  to: string | null | undefined,
  today: Date = new Date(),
): HistoryRange | null {
  if (!from || !to || !isValidIsoDate(from) || !isValidIsoDate(to)) return null;
  // El formato fijo AAAA-MM-DD permite comparar como texto
  if (from > to || to > toIsoDate(today)) return null;
  return { from, to };
}
