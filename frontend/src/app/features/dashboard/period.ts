export type PeriodOption = 'today' | '7d' | '30d';

export interface PeriodRange {
  from: string;
  to: string;
}

export interface PeriodRanges {
  current: PeriodRange;
  previous: PeriodRange;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Periodo anterior: misma duracion que "current", inmediatamente antes, sin
// solapamiento (previous.to === current.from). Compartido por la ventana
// corrediza de Inicio (7 dias/30 dias, mas abajo) y por el selector de rango
// libre de Metricas.
export function previousPeriodOf(current: PeriodRange): PeriodRange {
  const durationMs = new Date(current.to).getTime() - new Date(current.from).getTime();
  return {
    from: new Date(new Date(current.from).getTime() - durationMs).toISOString(),
    to: current.from,
  };
}

// "Hoy" se ancla a la medianoche local: el período actual es lo transcurrido
// del día calendario, y el anterior es el día calendario completo de ayer
// (no "la misma cantidad de horas transcurridas", a proposito distinto del
// caso 7/30 dias). "7 días"/"30 días" son ventana corrediza, reutilizando
// previousPeriodOf.
export function computePeriodRanges(option: PeriodOption, now: Date = new Date()): PeriodRanges {
  if (option === 'today') {
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday.getTime() - MS_PER_DAY);

    return {
      current: { from: startOfToday.toISOString(), to: now.toISOString() },
      previous: { from: startOfYesterday.toISOString(), to: startOfToday.toISOString() },
    };
  }

  const days = option === '7d' ? 7 : 30;
  const current = { from: new Date(now.getTime() - days * MS_PER_DAY).toISOString(), to: now.toISOString() };

  return { current, previous: previousPeriodOf(current) };
}

// --- Rango de dias de Metricas (AAAA-MM-DD + tz, contrato del backend) ---

export interface DayRange {
  from: string;
  to: string;
}

export const METRICS_TIMEZONE = 'America/Argentina/La_Rioja';

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// Dia calendario local en formato AAAA-MM-DD.
export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Inversa de toIsoDate: parsea los componentes a mano para construir una
// fecha local a medianoche. new Date('AAAA-MM-DD') se interpreta como UTC,
// y en husos detras de UTC (como este) muestra el dia anterior.
export function parseIsoDateLocal(day: string): Date {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, month - 1, date);
}

// Formato AAAA-MM-DD y fecha calendario real (rechaza por ejemplo "30 de
// febrero", que Date "arreglaria" corriendolo a marzo).
function isValidIsoDate(value: string): boolean {
  return ISO_DATE_PATTERN.test(value) && toIsoDate(parseIsoDateLocal(value)) === value;
}

// Resuelve un rango de dias a partir de dos valores de query param: solo se
// usan si AMBOS estan presentes, con formato AAAA-MM-DD y son fechas
// calendario validas (por ejemplo, una URL vieja con instantes ISO no pasa
// la validacion). Si falta cualquiera de los dos o no son validos, se cae
// al fallback completo.
export function resolveDateRange(from: string | null, to: string | null, fallback: DayRange): DayRange {
  if (from && to && isValidIsoDate(from) && isValidIsoDate(to)) {
    return { from, to };
  }
  return fallback;
}

// Rango por defecto de Metricas: los ultimos 30 dias calendario incluyendo
// hoy (from = hoy menos 29 dias, to = hoy). Distinto de
// computePeriodRanges('30d'), que es una ventana corrediza con la hora
// incluida y sigue siendo la que usa Inicio.
export function defaultMetricsDayRange(now: Date = new Date()): DayRange {
  const to = toIsoDate(now);
  const from = toIsoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29));
  return { from, to };
}

// Periodo anterior en dias: misma cantidad de dias que "current", termina
// el dia antes del primer dia de "current". Version en dias de
// previousPeriodOf, para Metricas.
export function previousCalendarDayRange(current: DayRange): DayRange {
  const currentFrom = parseIsoDateLocal(current.from);
  const currentTo = parseIsoDateLocal(current.to);
  const dayCount = Math.round((currentTo.getTime() - currentFrom.getTime()) / MS_PER_DAY) + 1;

  const to = new Date(currentFrom.getFullYear(), currentFrom.getMonth(), currentFrom.getDate() - 1);
  const from = new Date(to.getFullYear(), to.getMonth(), to.getDate() - (dayCount - 1));

  return { from: toIsoDate(from), to: toIsoDate(to) };
}
