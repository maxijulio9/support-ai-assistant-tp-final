// Tasa sobre un total: null si el total es 0 (no hay division por cero).
export function rate(count: number, total: number): number | null {
  return total > 0 ? count / total : null;
}

// Delta en puntos porcentuales: diferencia entre dos tasas (0-1), expresada
// en puntos (x100). null si falta cualquiera de los dos lados.
export function ppDelta(current: number | null, previous: number | null): number | null {
  return current !== null && previous !== null ? (current - previous) * 100 : null;
}

// Delta como diferencia cruda entre dos valores en la misma escala (no una
// tasa sobre un total). null si falta cualquiera de los dos lados.
export function rawDelta(current: number | null, previous: number | null): number | null {
  return current !== null && previous !== null ? current - previous : null;
}

export type DeltaDirection = 'up' | 'down' | 'flat';
export type DeltaTone = 'good' | 'bad' | 'neutral';
export type DeltaUnit = 'pp' | 'raw' | 'percent';

export interface DeltaView {
  direction: DeltaDirection;
  arrow: string;
  // Valor absoluto con coma decimal: la flecha lleva la direccion, el texto
  // no repite el signo.
  text: string;
  // Lectura para lectores de pantalla, sin depender de la flecha ni del color
  spoken: string;
  tone: DeltaTone;
}

const DELTA_ARROW: Record<DeltaDirection, string> = { up: '▲', down: '▼', flat: '▬' };

// Prepara un delta para mostrarlo: direccion, valor absoluto con coma y el
// tono segun si subir es bueno para esa metrica (una baja de escaladas es
// buena). Con higherIsBetter en null la metrica no tiene lado bueno (por
// ejemplo el volumen de solicitudes) y el tono es neutral. Un cambio que se redondea a cero se muestra como "sin cambios".
// null si no hay delta.
export function formatDelta(
  value: number | null,
  unit: DeltaUnit,
  decimals: number,
  higherIsBetter: boolean | null,
): DeltaView | null {
  if (value === null || !Number.isFinite(value)) return null;

  const magnitude = Math.abs(value).toFixed(decimals).replace('.', ',');
  const isZero = Number(Math.abs(value).toFixed(decimals)) === 0;
  const direction: DeltaDirection = isZero ? 'flat' : value > 0 ? 'up' : 'down';
  const suffix = unit === 'pp' ? ' pp' : unit === 'percent' ? '%' : '';
  const spokenUnit = unit === 'pp' ? ' puntos porcentuales' : unit === 'percent' ? ' por ciento' : '';

  const tone: DeltaTone =
    direction === 'flat' || higherIsBetter === null
      ? 'neutral'
      : (direction === 'up') === higherIsBetter
        ? 'good'
        : 'bad';
  const spoken =
    direction === 'flat'
      ? 'sin cambios respecto del período anterior'
      : `${direction === 'up' ? 'subió' : 'bajó'} ${magnitude}${spokenUnit} respecto del período anterior`;

  const text = direction === 'flat' ? 'sin cambios' : `${magnitude}${suffix}`;

  return { direction, arrow: DELTA_ARROW[direction], text, spoken, tone };
}

// Delta como crecimiento relativo (%): para conteos totales, no tasas. null
// si falta cualquiera de los dos lados o si el anterior es 0 (division por
// cero).
export function percentGrowth(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}
