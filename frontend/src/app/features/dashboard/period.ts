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
