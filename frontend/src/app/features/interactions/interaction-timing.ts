import { formatShortDate } from '../../shared/format-short-date';

export const RESPONSE_TIME_LABEL = 'Tiempo hasta responder';

// Duracion legible con las dos unidades mas grandes que importan:
// "45 s", "1 min 12 s", "2 h 5 min", "1 d 3 h". Se redondea al segundo.
export function formatDuration(milliseconds: number): string {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return '';
  const totalSeconds = Math.round(milliseconds / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return hours > 0 ? `${days} d ${hours} h` : `${days} d`;
  if (hours > 0) return minutes > 0 ? `${hours} h ${minutes} min` : `${hours} h`;
  if (minutes > 0) return seconds > 0 ? `${minutes} min ${seconds} s` : `${minutes} min`;
  return `${seconds} s`;
}

export interface ResponseTimeInput {
  created_at: string | null | undefined;
  responded_at: string | null | undefined;
  reviewed_at: string | null | undefined;
}

function toTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

// Tiempo entre que se registro la interaccion y se respondio al cliente. Solo
// tiene sentido cuando respondio el sistema: con revision humana en el medio
// el tiempo incluye la espera de una persona, asi que no se muestra. Sin
// ambas fechas legibles, o con la respuesta anterior al registro, tampoco.
export function responseTimeText(input: ResponseTimeInput): string | null {
  if (input.reviewed_at) return null;
  const created = toTime(input.created_at);
  const responded = toTime(input.responded_at);
  if (created === null || responded === null || responded < created) return null;
  return formatDuration(responded - created);
}

export interface TimelineInput {
  decision: string | null;
  created_at: string | null | undefined;
  generated_at: string | null | undefined;
  reviewed_at: string | null | undefined;
  reviewed_by_name: string | null | undefined;
  responded_at: string | null | undefined;
}

export interface TimelineEvent {
  key: string;
  label: string;
  // Texto de la fecha; null si el evento no tiene fecha legible (solo el fallo de publicacion)
  date: string | null;
  tone: 'default' | 'failed';
}

export const PUBLISH_FAILED_DECISION = 'PUBLISH_FAILED';

// Hitos de la interaccion en orden, omitiendo los que no tienen fecha. Si
// fallo la publicacion, el ultimo hito pasa a ser "Falló la publicación" y se
// muestra aunque no tenga fecha: es lo que paso.
export function buildTimeline(input: TimelineInput, now: Date = new Date()): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const add = (key: string, label: string, value: string | null | undefined) => {
    const date = formatShortDate(value, now);
    if (date) events.push({ key, label, date, tone: 'default' });
  };

  add('created', 'Interacción registrada', input.created_at);
  add('generated', 'Respuesta sugerida generada', input.generated_at);
  const name = input.reviewed_by_name?.trim() ?? '';
  add('reviewed', name ? `Revisada por ${name}` : 'Revisada', input.reviewed_at);

  if (input.decision === PUBLISH_FAILED_DECISION) {
    events.push({
      key: 'failed',
      label: 'Falló la publicación',
      date: formatShortDate(input.responded_at, now) || null,
      tone: 'failed',
    });
  } else {
    add('published', 'Publicada al cliente', input.responded_at);
  }
  return events;
}
