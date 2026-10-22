// Color por decision, compartido entre el donut de Inicio
// (decisions-donut.component.ts) y la distribucion de decisiones de
// Metricas (decisiones-confianza.component.ts), para que las dos pantallas
// usen siempre el mismo token y nunca queden desincronizadas.
export const OTHER_SEGMENT_KEY = 'OTHER';

// Un color de _tokens.scss por decision real, mas OTHER_SEGMENT_KEY como
// resguardo para cualquier clave sin mapear (por ejemplo el segmento "Otras"
// del donut de Inicio). RESOLVED_GROUP (el grupo "Resueltas, incluye
// externas" de Metricas) usa el mismo color que Resuelta: ahi es un solo
// segmento, no dos.
const DECISION_COLOR_VAR: Record<string, string> = {
  AUTO_PUBLISH: '--app-color-decision-auto-publish',
  NEEDS_REVIEW: '--app-color-decision-needs-review',
  ESCALATE: '--app-color-decision-escalate',
  REQUEST_INFO: '--app-color-decision-request-info',
  DISCARDED: '--app-color-decision-discarded',
  RESOLVED_GROUP: '--app-color-decision-resolved',
  [OTHER_SEGMENT_KEY]: '--app-color-decision-other',
};

// Se usa desde HTML/CSS normal (con el nombre de la variable tal cual, en un
// var() real) y desde un canvas de echarts, que no puede resolver var()
// solo y necesita el color literal (ver resolveSegmentColor), para que las
// dos pantallas que pintan decisiones por color siempre salgan del mismo
// token.
export function resolveSegmentColorVar(key: string): string {
  return DECISION_COLOR_VAR[key] ?? DECISION_COLOR_VAR[OTHER_SEGMENT_KEY];
}

export function resolveSegmentColor(key: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(resolveSegmentColorVar(key)).trim();
}
