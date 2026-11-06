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

// Valor literal de cualquier variable de tema, para el canvas de echarts.
export function resolveThemeColor(varName: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
}

export function resolveSegmentColor(key: string): string {
  return resolveThemeColor(resolveSegmentColorVar(key));
}

const SRGB_FUNCTION = /^color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)(?: \/ ([\d.]+%?))?\)$/;

// Color de una variable como rgb() o rgba() literal. El canvas de echarts no
// entiende color-mix() ni color(), que es lo que devuelve el navegador para
// los tokens con mezcla: se convierten los canales de color(srgb ...) y, si
// viniera otro formato, se pasa por un canvas de 1 px.
export function resolveThemeColorRgba(varName: string): string {
  const probe = document.createElement('span');
  probe.style.color = `var(${varName})`;
  probe.style.display = 'none';
  document.body.appendChild(probe);
  const computed = getComputedStyle(probe).color;
  probe.remove();

  const srgb = SRGB_FUNCTION.exec(computed);
  if (srgb) {
    const [r, g, b] = [srgb[1], srgb[2], srgb[3]].map((channel) => Math.round(Number(channel) * 255));
    const alpha = srgb[4] === undefined ? 1 : srgb[4].endsWith('%') ? Number(srgb[4].slice(0, -1)) / 100 : Number(srgb[4]);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  if (computed.startsWith('rgb')) return computed;

  const context = document.createElement('canvas').getContext('2d');
  if (!context) return computed;
  context.fillStyle = computed;
  return context.fillStyle;
}
