import { decisionStatus } from './interaction-status';
import { resolutionChannelLabel } from './resolution-channel';

export const ANALYSIS_TITLE = 'Análisis del sistema';

export interface AnalysisInput {
  category: string | null;
  priority: string | null;
  system_decision: string | null;
  resolution_channel: string | null;
  confidence_score: number | null;
}

export interface AnalysisRow {
  label: string;
  value: string;
}

// Confianza como porcentaje entero entre 0 y 100; null sin dato
export function confidencePercent(score: number | null | undefined): number | null {
  if (score === null || score === undefined || Number.isNaN(score)) return null;
  return Math.min(100, Math.max(0, Math.round(score * 100)));
}

const present = (value: string | null | undefined): value is string => typeof value === 'string' && value.trim() !== '';

// Solo las filas que tienen dato, en orden. La confianza va aparte, como barra.
export function analysisRows(input: AnalysisInput): AnalysisRow[] {
  const rows: AnalysisRow[] = [];
  if (present(input.category)) rows.push({ label: 'Categoría', value: input.category });
  if (present(input.priority)) rows.push({ label: 'Prioridad', value: input.priority });
  if (present(input.system_decision)) {
    rows.push({ label: 'Decisión original del sistema', value: decisionStatus(input.system_decision).label });
  }
  if (present(input.resolution_channel)) {
    rows.push({ label: 'Canal de resolución', value: resolutionChannelLabel(input.resolution_channel) });
  }
  return rows;
}

// Hay algo para mostrar en el bloque
export function hasAnalysis(input: AnalysisInput): boolean {
  return analysisRows(input).length > 0 || confidencePercent(input.confidence_score) !== null;
}
