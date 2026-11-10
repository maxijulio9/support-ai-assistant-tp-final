import { InteractionListItem } from '../../../api/models/interaction-list-item';
import { newestFirst } from '../case-grouping';
import { decisionStatus } from '../interaction-status';
import { resolutionChannelLabel } from '../resolution-channel';
import { HistoryRange } from '../history-range';

// Exportacion del Historial a CSV y PDF. Todo lo que no toca el navegador
// (columnas, filas, escape, plan de paginas, nombre y descripcion de filtros)
// son funciones puras para poder fijarlas con specs.

// Interacciones por pedido. El backend no pone tope a limit, asi que es una
// eleccion propia: pocos pedidos sin respuestas enormes.
export const EXPORT_PAGE_SIZE = 500;
// Tope de filas de un archivo, para CSV y PDF: las mas recientes
export const EXPORT_ROW_LIMIT = 1000;

export const EXPORT_COLUMNS = [
  'Ticket',
  'Fecha',
  'Decisión',
  'Categoría',
  'Prioridad',
  'Confianza',
  'Canal de resolución',
  'Editada',
  'Respuesta al cliente',
  'Resumen',
] as const;

export const NOT_RECORDED_TEXT = 'No registrada';

const pad = (value: number) => String(value).padStart(2, '0');

// "05/11/2026 21:57": dia/mes/año y hora de 24 h, en la hora del navegador.
// Una fecha ausente o ilegible queda vacia.
export function formatExportDate(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// AAAA-MM-DD a "05/11/2026"
export function formatIsoDay(day: string): string {
  const [year, month, date] = day.split('-');
  return `${date}/${month}/${year}`;
}

export function confidenceText(score: number | null | undefined): string {
  if (score === null || score === undefined || Number.isNaN(score)) return '';
  return `${Math.min(100, Math.max(0, Math.round(score * 100)))}%`;
}

// Resumen largo: se corta con elipsis para que la fila del PDF no ocupe media pagina
export const SUMMARY_MAX_LENGTH = 140;

export function truncateText(text: string, maxLength: number = SUMMARY_MAX_LENGTH): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

// Una fila por interaccion, la mas reciente primero, con las mismas etiquetas
// que la pantalla
export function buildExportRows(items: readonly InteractionListItem[]): string[][] {
  return items
    .slice()
    .sort(newestFirst)
    .map((item) => [
      item.issue_key,
      formatExportDate(item.created_at),
      decisionStatus(item.decision).label,
      item.category ?? '',
      item.priority ?? '',
      confidenceText(item.confidence_score),
      resolutionChannelLabel(item.resolution_channel),
      item.was_edited ? 'Sí' : 'No',
      formatExportDate(item.responded_at) || NOT_RECORDED_TEXT,
      item.summary ?? '',
    ]);
}

// --- CSV ---

const FORMULA_START = /^[=+\-@\t\r]/;

// Una celda de texto que empieza con un caracter que una planilla toma como
// formula se prefija con apostrofo, para que se vea como texto
export function neutralizeFormula(value: string): string {
  return FORMULA_START.test(value) ? `'${value}` : value;
}

export const CSV_SEPARATOR = ';';
export const CSV_NEWLINE = '\r\n';
const BOM = '﻿';

export function escapeCsvCell(value: string): string {
  const safe = neutralizeFormula(value);
  return /[;"\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

// UTF-8 con BOM, separador punto y coma (Excel en español abre en columnas) y CRLF
export function buildCsv(columns: readonly string[], rows: readonly (readonly string[])[]): string {
  const lines = [columns, ...rows].map((row) => row.map(escapeCsvCell).join(CSV_SEPARATOR));
  return BOM + lines.join(CSV_NEWLINE) + CSV_NEWLINE;
}

// --- Pedidos por pagina ---

export interface ExportPagePlan {
  // Desplazamientos a pedir, de a EXPORT_PAGE_SIZE, el primero es 0
  offsets: number[];
  // Filas que se van a exportar como maximo
  target: number;
  // El total supera el tope: se exporta hasta el tope
  capped: boolean;
}

export function planExportPages(total: number, pageSize: number = EXPORT_PAGE_SIZE, rowLimit: number = EXPORT_ROW_LIMIT): ExportPagePlan {
  const safeTotal = Number.isFinite(total) && total > 0 ? Math.floor(total) : 0;
  const target = Math.min(safeTotal, rowLimit);
  const offsets: number[] = [];
  for (let offset = 0; offset < target; offset += pageSize) offsets.push(offset);
  return { offsets, target, capped: safeTotal > rowLimit };
}

// Cuantas filas pedir en el desplazamiento dado: la ultima pagina pide solo
// las que faltan para llegar al tope, nunca de mas
export function pageLimitFor(offset: number, target: number, pageSize: number = EXPORT_PAGE_SIZE): number {
  return Math.max(0, Math.min(pageSize, target - offset));
}

// --- Nombre y descripcion de filtros ---

export function exportFileName(extension: 'csv' | 'pdf', now: Date = new Date()): string {
  return `historial-interacciones-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.${extension}`;
}

export interface ExportFilters {
  range: HistoryRange | null;
  statusLabel: string | null;
  category: string | null;
  term: string;
}

// Lineas "Etiqueta: valor" para el encabezado del PDF
export function describeFilters(filters: ExportFilters): string[] {
  const term = filters.term.trim();
  return [
    filters.range
      ? `Rango: ${formatIsoDay(filters.range.from)} al ${formatIsoDay(filters.range.to)}`
      : 'Rango: Todo el historial',
    `Estado: ${filters.statusLabel ?? 'Todos'}`,
    `Categoría: ${filters.category ?? 'Todas'}`,
    `Búsqueda: ${term === '' ? 'Ninguna' : term}`,
  ];
}

// Texto del tope, antes y despues de exportar
export const ROW_LIMIT_NOTICE = `Se exportan las ${EXPORT_ROW_LIMIT} interacciones más recientes que cumplen los filtros. Para ver más, acotá el rango de fechas.`;

// Aviso del menu antes de exportar. Con o sin rango se piden todas las
// paginas hasta el tope; periodTotal es el total que dio la lista.
export function exportScopeNotice(range: HistoryRange | null, periodTotal: number): string {
  if (periodTotal > EXPORT_ROW_LIMIT) return ROW_LIMIT_NOTICE;
  return range === null
    ? 'Se exporta todo el historial con los filtros activos.'
    : 'Se exporta el período completo con los filtros activos.';
}

export function exportDoneMessage(exported: number, total: number, capped: boolean): string {
  if (capped) return `Se exportaron las ${exported} interacciones más recientes de ${total} que cumplen los filtros. Para ver más, acotá el rango de fechas.`;
  return exported === 1 ? 'Se exportó 1 interacción.' : `Se exportaron ${exported} interacciones.`;
}
