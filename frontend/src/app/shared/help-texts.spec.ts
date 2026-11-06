import { DASHBOARD_CHART_HELP, KPI_HELP, METRICS_CHART_HELP } from './help-texts';

const ALL = [...Object.values(KPI_HELP), ...Object.values(METRICS_CHART_HELP), ...Object.values(DASHBOARD_CHART_HELP)];

describe('textos de ayuda', () => {
  it('todos tienen titulo y texto', () => {
    for (const help of ALL) {
      expect(help.title.trim()).not.toBe('');
      expect(help.text.trim()).not.toBe('');
    }
  });

  it('sin em dash, sin barras de separador ni claves de tickets', () => {
    for (const help of ALL) {
      const joined = `${help.title} ${help.text}`;
      expect(joined).not.toContain(String.fromCharCode(0x2014));
      expect(joined).not.toContain('·');
      expect(joined).not.toMatch(/[A-Z]{2,}-\d+/);
    }
  });

  it('los textos terminan en punto', () => {
    for (const help of ALL) expect(help.text.endsWith('.')).toBe(true);
  });

  it('las tarjetas usan el texto acordado', () => {
    expect(KPI_HELP.total.text).toBe(
      'Cantidad de solicitudes recibidas en el período elegido. La línea muestra cuántas llegaron cada día. El cambio contra el período anterior se expresa en porcentaje.',
    );
    expect(KPI_HELP.autoPublish.text).toContain('pasar de 20 % a 25 % es +5 pp.');
    expect(KPI_HELP.escalate.text).toContain('Un valor más bajo es mejor.');
    expect(KPI_HELP.confidence.text).toContain('es la diferencia entre promedios.');
  });
});
