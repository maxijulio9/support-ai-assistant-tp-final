// Texto legible sobre el color de fondo de un segmento de decision
// (decision-colors.ts): en vez de asumir siempre el mismo texto claro sin
// importar que tan vivo sea el fondo, calcula el contraste WCAG real contra
// las dos opciones del tema y elige la que de mayor ratio.
import { resolveSegmentColor } from './decision-colors';

const LIGHT_TEXT_VAR = '--mat-sys-on-primary';
const DARK_TEXT_VAR = '--mat-sys-on-surface';

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '');
  const value = parseInt(normalized, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

// Luminancia relativa WCAG (https://www.w3.org/TR/WCAG21/#dfn-relative-luminance).
function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Ratio de contraste WCAG (https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio)
// entre dos colores en formato #rrggbb. Simetrico: el orden no importa.
export function contrastRatio(hexA: string, hexB: string): number {
  const [lighter, darker] = [relativeLuminance(hexA), relativeLuminance(hexB)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

// Pura: recibe los tres colores ya resueltos (#rrggbb) y devuelve el nombre
// de la variable de texto (claro u oscuro) que da mayor contraste contra el
// fondo. No lee el DOM, por eso es la parte testeable de forma permanente.
export function readableTextColorVar(backgroundHex: string, lightTextHex: string, darkTextHex: string): string {
  const withDark = contrastRatio(backgroundHex, darkTextHex);
  const withLight = contrastRatio(backgroundHex, lightTextHex);
  return withDark > withLight ? DARK_TEXT_VAR : LIGHT_TEXT_VAR;
}

// Resuelve los tres colores reales desde el DOM (mismo mecanismo que
// resolveSegmentColor en decision-colors.ts) y devuelve el nombre de la
// variable de texto a usar para el segmento de esa clave.
export function resolveSegmentTextColorVar(key: string): string {
  const styles = getComputedStyle(document.documentElement);
  const backgroundHex = resolveSegmentColor(key);
  const lightTextHex = styles.getPropertyValue(LIGHT_TEXT_VAR).trim();
  const darkTextHex = styles.getPropertyValue(DARK_TEXT_VAR).trim();
  return readableTextColorVar(backgroundHex, lightTextHex, darkTextHex);
}
