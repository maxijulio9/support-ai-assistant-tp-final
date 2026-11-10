import { resolveThemeColor } from '../../../shared/decision-colors';
import { EXPORT_COLUMNS, ExportFilters, SUMMARY_MAX_LENGTH, buildCsv, describeFilters, truncateText } from './history-export';

// Parte del navegador de la exportacion: arma los archivos y los descarga.
// jspdf y jspdf-autotable se cargan con import dinamico solo al exportar, para
// que no entren en el bundle inicial.

export function csvBlob(rows: readonly (readonly string[])[]): Blob {
  return new Blob([buildCsv(EXPORT_COLUMNS, rows)], { type: 'text/csv;charset=utf-8' });
}

export interface PdfInput {
  rows: readonly (readonly string[])[];
  filters: ExportFilters;
  generatedAt: Date;
  capped: boolean;
}

const TITLE = 'Historial de interacciones';

// Color de un token del tema como #rrggbb; si el navegador lo devuelve en otro
// formato se usa el de respaldo
function themeHex(token: string, fallback: string): string {
  const value = resolveThemeColor(token);
  return /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

function generatedAtText(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// A4 horizontal: titulo, fecha de generacion, filtros y cantidad de filas, y la
// tabla con el encabezado repetido en cada pagina y el numero de pagina al pie
export async function buildPdf(input: PdfInput): Promise<Blob> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);

  const primary = themeHex('--mat-sys-primary', '#005e75');
  const onPrimary = themeHex('--mat-sys-on-primary', '#ffffff');
  const text = themeHex('--mat-sys-on-surface', '#1a1c1e');
  const secondary = themeHex('--app-color-text-secondary', '#6b6e77');

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const margin = 32;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  doc.setTextColor(text);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(TITLE, margin, margin + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(secondary);
  const count = `${input.rows.length}${input.capped ? ' (tope de un archivo)' : ''}`;
  const header = [`Generado el ${generatedAtText(input.generatedAt)}`, ...describeFilters(input.filters), `Filas exportadas: ${count}`];
  header.forEach((line, index) => doc.text(line, margin, margin + 26 + index * 12));
  const tableTop = margin + 26 + header.length * 12 + 8;

  autoTable(doc, {
    startY: tableTop,
    margin: { left: margin, right: margin, top: margin, bottom: margin + 16 },
    head: [[...EXPORT_COLUMNS]],
    body: input.rows.map((row) => row.map((cell, index) => (index === row.length - 1 ? truncateText(cell, SUMMARY_MAX_LENGTH) : cell))),
    theme: 'grid',
    showHead: 'everyPage',
    styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 3, textColor: text, lineColor: '#d7d9de', lineWidth: 0.4, overflow: 'linebreak' },
    headStyles: { fillColor: primary, textColor: onPrimary, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 52 },
      1: { cellWidth: 68 },
      2: { cellWidth: 78 },
      3: { cellWidth: 62 },
      4: { cellWidth: 44 },
      5: { cellWidth: 44 },
      6: { cellWidth: 78 },
      7: { cellWidth: 36 },
      8: { cellWidth: 68 },
    },
  });

  const pages = doc.getNumberOfPages();
  doc.setFontSize(8);
  doc.setTextColor(secondary);
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.text(`Página ${page} de ${pages}`, pageWidth - margin, pageHeight - margin + 6, { align: 'right' });
  }

  return doc.output('blob');
}

// Descarga un blob con el nombre dado
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Se libera despues del clic: algunos navegadores leen la url de forma asincrona
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
