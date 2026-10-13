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

// "Hoy" se ancla a la medianoche local: el período actual es lo transcurrido
// del día calendario, y el anterior es el día calendario completo de ayer.
// "7 días"/"30 días" son ventana corrediza: el período anterior es la misma
// cantidad de días, inmediatamente antes de donde arranca el actual. Son dos
// reglas distintas a proposito, no una formula unica.
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
  const currentFrom = new Date(now.getTime() - days * MS_PER_DAY);
  const previousFrom = new Date(currentFrom.getTime() - days * MS_PER_DAY);

  return {
    current: { from: currentFrom.toISOString(), to: now.toISOString() },
    previous: { from: previousFrom.toISOString(), to: currentFrom.toISOString() },
  };
}
