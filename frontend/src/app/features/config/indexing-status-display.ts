import { IndexingStatusResponse } from '../../api/models/indexing-status-response';

export type IndexingDisplayTone = 'progress' | 'neutral' | 'error';

// Una corrida "running" con un started_at mas viejo que esto se considera
// huerfana (el worker probablemente se interrumpio sin dejar un estado
// terminal). Facil de ajustar si cambia la duracion tipica de una corrida.
export const ORPHAN_RUN_THRESHOLD_MS = 60 * 60 * 1000;

export function formatIndexingTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' });
}

export function isOrphanedIndexingStatus(status: IndexingStatusResponse, now: number = Date.now()): boolean {
  if (status.status !== 'running') return false;
  const startedAt = new Date(status.started_at).getTime();
  if (Number.isNaN(startedAt)) return false;
  return now - startedAt > ORPHAN_RUN_THRESHOLD_MS;
}

// status === null cubre tanto "todavia no se cargo" como el 404 confirmado
// de que nunca se disparo una indexacion ("Sin corridas"); quien llama
// distingue ambos casos por fuera (por su propio estado de carga).
export function indexingStatusLabel(status: IndexingStatusResponse | null): string {
  if (!status) return 'Sin corridas';
  switch (status.status) {
    case 'running':
      return 'En curso';
    case 'completed':
      return 'Finalizada';
    case 'failed':
      return 'Fallida';
    default:
      return status.status;
  }
}

export function indexingStatusTone(status: IndexingStatusResponse | null): IndexingDisplayTone {
  if (!status) return 'neutral';
  switch (status.status) {
    case 'running':
      return 'progress';
    case 'failed':
      return 'error';
    default:
      // completed se muestra en tono neutro, no de exito: que el estado
      // haya quedado en completed no garantiza que el resultado sea valido.
      return 'neutral';
  }
}

// Linea secundaria para resumenes (tarjeta del centro): cuando nunca hubo
// una corrida, no hay fecha que mostrar.
export function indexingLastRunLabel(status: IndexingStatusResponse | null): string | null {
  if (!status) return null;
  return `Última corrida: ${formatIndexingTimestamp(status.started_at)}`;
}
