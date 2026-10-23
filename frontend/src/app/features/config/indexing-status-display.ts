import { IndexingStatusResponse } from '../../api/models/indexing-status-response';
import { StartIndexingResponse } from '../../api/models/start-indexing-response';

export type IndexingDisplayTone = 'progress' | 'success' | 'neutral' | 'error';

export const ERROR_DETAIL_PREVIEW_LENGTH = 180;

// Forma minima para indexingStatusLabel/indexingStatusTone: ambas solo leen
// el campo status, asi que no hace falta un IndexingStatusResponse
// completo. Permite reusarlas con la corrida de un espacio (IndexedSpaceRun
// en indexed-spaces-display.ts), que no tiene space_keys ni contadores.
export interface IndexingRunLike {
  status: string;
}

export function formatIndexingTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' });
}

// status === null cubre tanto "todavia no se cargo" como el 404 confirmado
// de que nunca se disparo una indexacion ("Sin corridas"); quien llama
// distingue ambos casos por fuera (por su propio estado de carga).
export function indexingStatusLabel(status: IndexingRunLike | null): string {
  if (!status) return 'Sin corridas';
  switch (status.status) {
    case 'queued':
      return 'En cola';
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

export function indexingStatusTone(status: IndexingRunLike | null): IndexingDisplayTone {
  if (!status) return 'neutral';
  switch (status.status) {
    case 'queued':
    case 'running':
      return 'progress';
    case 'completed':
      return 'success';
    case 'failed':
      return 'error';
    default:
      return 'neutral';
  }
}

// Linea secundaria para resumenes (tarjeta del centro): cuando nunca hubo
// una corrida, no hay fecha que mostrar.
export function indexingLastRunLabel(status: IndexingStatusResponse | null): string | null {
  if (!status) return null;
  return `Última corrida: ${formatIndexingTimestamp(status.started_at)}`;
}

// Corridas de antes de que se empezaran a registrar estos datos: llegan en
// un estado terminal (completed o failed) con los dos contadores en 0 y
// total_documents en null. Se identifican asi para mostrarlas como "sin
// datos" en vez de como si no se hubiera procesado nada. Una corrida en
// queued o running con esos mismos valores no cuenta: todavia no tuvo
// tiempo de generar nada, es un estado valido, no datos faltantes.
export function hasNoIndexingData(status: IndexingStatusResponse): boolean {
  return (
    (status.status === 'completed' || status.status === 'failed') &&
    status.documents_processed === 0 &&
    status.chunks_generated === 0 &&
    status.total_documents === null
  );
}

// Estado a mostrar apenas responde el POST de inicio, antes de que llegue
// el primer GET real. StartIndexingResponse no trae espacios ni
// contadores: los espacios se completan con los que se acaban de enviar
// (unico lugar donde se conocen en este punto), y los contadores con el
// arranque de una corrida que todavia no genero nada.
export function buildOptimisticIndexingStatus(
  response: StartIndexingResponse,
  spaceKeys: string[],
): IndexingStatusResponse {
  return {
    id: response.id,
    status: response.status,
    started_at: response.started_at,
    updated_at: response.started_at,
    space_keys: spaceKeys,
    documents_processed: 0,
    chunks_generated: 0,
    total_documents: null,
    error_detail: null,
  };
}

// true solo cuando el estado anterior estaba en curso (queued o running) y
// el actual ya es terminal (completed o failed): una corrida que recien
// termino. previousStatus null (primera carga, todavia no se observo
// ningun estado) siempre da false, para no disparar una recarga de mas
// apenas se monta la pantalla.
export function justFinishedIndexing(previousStatus: string | null, currentStatus: string | null): boolean {
  const wasInProgress = previousStatus === 'queued' || previousStatus === 'running';
  const isTerminal = currentStatus === 'completed' || currentStatus === 'failed';
  return wasInProgress && isTerminal;
}

// error_detail puede llegar con hasta 2000 caracteres, texto tecnico: se
// recorta para no ocupar toda la pantalla, con la opcion de expandirlo
// (ver errorExpanded en indexing-status.component.ts).
export function truncatedErrorDetail(
  detail: string,
  maxLength: number = ERROR_DETAIL_PREVIEW_LENGTH,
): { preview: string; isTruncated: boolean } {
  if (detail.length <= maxLength) return { preview: detail, isTruncated: false };
  return { preview: `${detail.slice(0, maxLength).trimEnd()}…`, isTruncated: true };
}
