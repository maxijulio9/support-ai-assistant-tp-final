import { isProjectActive } from '../../shared/project-activity';

// Estado de carga generico de una seccion del centro de Configuracion
// (JSM, Confluence, Proyectos, Indexacion). 'idle' es "todavia no se pidio",
// distinto de 'loading': permite que cada pantalla decida si dispara la
// carga (ensureLoaded) o si solo necesita refrescar lo que ya hay.
export type SectionLoadState = 'idle' | 'loading' | 'loaded' | 'error';

export interface SectionSlot<T> {
  state: SectionLoadState;
  data: T | null;
  errorMessage: string | null;
}

export function idleSlot<T>(): SectionSlot<T> {
  return { state: 'idle', data: null, errorMessage: null };
}

// Estado de un segmento en la franja "Preparacion del asistente". 'pending'
// y 'unset' se diferencian a proposito: Proyectos usa 'pending' (reloj,
// ambar) para "todavia sin proyectos", mientras que JSM/Confluence usan
// 'unset' (gris) para "todavia no conectado", ver sectionReadinessState.
export type ReadinessState = 'ready' | 'pending' | 'unset' | 'error';

export interface ReadinessSection {
  id: string;
  label: string;
  state: ReadinessState;
  // false para Modelo de lenguaje mientras no haya backend: se muestra en
  // la franja, atenuado, pero no cuenta en el total.
  counts: boolean;
}

export interface ReadinessSummary {
  readyCount: number;
  totalCount: number;
  // Sistema recien instalado: ninguna seccion contada esta lista y ninguna
  // esta en error. No exige que todas esten literalmente en 'unset' (por
  // ejemplo Proyectos con 0 incorporados es 'pending', no 'unset', y el
  // estado inicial sigue siendo de bienvenida). El LLM no rompe esta
  // condicion mientras no tenga backend porque llmReadinessState() lo deja
  // fijo en 'unset' (ni listo ni error); el dia que tenga backend, su
  // estado real participa igual que el de cualquier otra seccion.
  showWelcome: boolean;
  erroredLabels: string[];
}

export function summarizeReadiness(sections: ReadinessSection[]): ReadinessSummary {
  const counted = sections.filter((section) => section.counts);
  const readyCount = counted.filter((section) => section.state === 'ready').length;
  const erroredLabels = counted
    .filter((section) => section.state === 'error')
    .map((section) => section.label);
  const showWelcome = counted.length > 0 && readyCount === 0 && erroredLabels.length === 0;

  return { readyCount, totalCount: counted.length, showWelcome, erroredLabels };
}

export function readinessHeadline(summary: ReadinessSummary): string {
  const base = `${summary.readyCount} de ${summary.totalCount} secciones listas`;
  if (summary.erroredLabels.length === 0) return base;
  return `${base}, ${summary.erroredLabels.join(', ')} sin verificar`;
}

// Generico: listo si cargo y el dato cumple isReady; error si la carga
// fallo; sin dato en cualquier otro caso (idle, loading, o cargo pero no
// cumple isReady). Usado por JSM y Confluence (configured === true).
export function sectionReadinessState<T>(
  slot: SectionSlot<T>,
  isReady: (data: T) => boolean,
): ReadinessState {
  if (slot.state === 'error') return 'error';
  if (slot.state === 'loaded' && slot.data !== null && isReady(slot.data)) return 'ready';
  return 'unset';
}

// Proyectos no tiene un estado "sin dato": mientras no haya al menos un
// proyecto activo se muestra "pendiente" (reloj, ambar), nunca el guion
// neutro que usan JSM y Confluence. Uno inactivo no cuenta: el sistema
// ignora sus tickets.
export function projectsReadinessState(slot: SectionSlot<{ is_active: boolean }[]>): ReadinessState {
  if (slot.state === 'error') return 'error';
  if (slot.state === 'loaded' && (slot.data ?? []).some(isProjectActive)) return 'ready';
  return 'pending';
}

// Tono de chip que usan las tarjetas del centro (section-card.component).
// info (azul, tema) es el unico tono que no tiene un correlato en
// ReadinessState: lo usa la tarjeta de Proyectos cuando hay al menos uno
// incorporado, para destacarlo sin usar el verde de "listo".
export type SectionCardTone = 'success' | 'neutral' | 'error' | 'progress' | 'info';
export type SectionCardLoadState = 'loading' | 'error' | 'loaded';

export interface SectionCardChip {
  label: string;
  tone: SectionCardTone;
}

export function toSectionCardLoadState(state: SectionLoadState): SectionCardLoadState {
  if (state === 'error') return 'error';
  if (state === 'loaded') return 'loaded';
  return 'loading';
}

// JSM y Confluence comparten esta misma regla: solo configured === true
// cuenta como conectado.
export function connectionCardChip(data: { configured: boolean } | null): SectionCardChip {
  const connected = data?.configured ?? false;
  return connected ? { label: 'Conectado', tone: 'success' } : { label: 'No conectado', tone: 'neutral' };
}

export function projectsCardChip(data: { is_active: boolean }[] | null): SectionCardChip {
  const total = data?.length ?? 0;
  if (total === 0) return { label: '0 incorporados', tone: 'neutral' };

  const active = (data ?? []).filter(isProjectActive).length;
  const inactive = total - active;
  const activeText = `${active} ${active === 1 ? 'activo' : 'activos'}`;
  const label = inactive > 0 ? `${activeText}, ${inactive} ${inactive === 1 ? 'inactivo' : 'inactivos'}` : activeText;
  return { label, tone: active > 0 ? 'info' : 'neutral' };
}

// "Configurado" solo cuando las dos partes (generacion y embeddings) lo
// estan; da lo mismo si el origen es la base de datos o las variables de
// entorno (configured ya viene en true en ambos casos).
export function llmCardChip(
  data: { generation: { configured: boolean }; embeddings: { configured: boolean } } | null,
): SectionCardChip {
  const bothConfigured = data !== null && data.generation.configured && data.embeddings.configured;
  return bothConfigured ? { label: 'Configurado', tone: 'success' } : { label: 'Pendiente', tone: 'neutral' };
}
