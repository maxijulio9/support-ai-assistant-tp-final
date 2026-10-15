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

// Resuelve un rango a partir de dos valores de query param: solo se usan si
// AMBOS (from y to) estan presentes juntos, como par atomico. Si falta
// cualquiera de los dos, se cae al fallback completo (nunca se mezcla un
// query param real con la mitad del fallback).
export function resolveDateRange(from: string | null, to: string | null, fallback: PeriodRange): PeriodRange {
  return from && to ? { from, to } : fallback;
}

// Convierte un rango de dias calendario (la hora de los Date recibidos se
// ignora) a un rango de instantes en UTC: "from" es la medianoche local del
// primer dia, "to" es la medianoche local del dia SIGUIENTE al ultimo, para
// que el extremo superior sea exclusivo y el ultimo dia quede incluido
// completo. Se usa para el selector de rango libre de Metricas, no para las
// ventanas corredizas de Inicio.
export function calendarDaysToInstantRange(firstDay: Date, lastDay: Date): PeriodRange {
  const from = new Date(firstDay.getFullYear(), firstDay.getMonth(), firstDay.getDate());
  const to = new Date(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate() + 1);
  return { from: from.toISOString(), to: to.toISOString() };
}

// Inversa del extremo superior de calendarDaysToInstantRange: recupera el
// ultimo dia elegido a partir de un "to" exclusivo, restando 1 ms para caer
// dentro de ese dia en vez de en la medianoche siguiente.
export function lastDayOfInstantRange(to: string): Date {
  return new Date(new Date(to).getTime() - 1);
}

// Rango por defecto de Metricas: los ultimos 30 dias calendario incluyendo
// hoy (de "hace 29 dias" a hoy), con el mismo criterio de extremo superior
// exclusivo que calendarDaysToInstantRange. Distinto de
// computePeriodRanges('30d'), que es una ventana corrediza con la hora
// incluida y sigue siendo la que usa Inicio.
export function defaultMetricsRange(now: Date = new Date()): PeriodRange {
  const firstDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
  return calendarDaysToInstantRange(firstDay, now);
}
