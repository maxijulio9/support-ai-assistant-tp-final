import { STATUS_FILTER_OPTIONS, decisionStatus } from './interaction-status';

describe('decisionStatus', () => {
  it('mapea las 5 decisiones conocidas', () => {
    expect(decisionStatus('AUTO_PUBLISH')).toEqual({ label: 'Publicada', tone: 'success' });
    expect(decisionStatus('NEEDS_REVIEW')).toEqual({ label: 'Pendiente de revisión', tone: 'warning' });
    expect(decisionStatus('ESCALATE')).toEqual({ label: 'Escalada', tone: 'error' });
    expect(decisionStatus('REQUEST_INFO')).toEqual({ label: 'Información solicitada', tone: 'neutral' });
  });

  it('DISCARDED se muestra como "Descartada" en tono neutral', () => {
    expect(decisionStatus('DISCARDED')).toEqual({ label: 'Descartada', tone: 'neutral' });
  });

  it('decision null usa un rotulo propio, no texto crudo', () => {
    expect(decisionStatus(null)).toEqual({ label: 'Sin estado', tone: 'neutral' });
  });

  it('una decision desconocida se muestra con su valor crudo, sin romper, en tono neutral', () => {
    expect(decisionStatus('UNA_DECISION_FUTURA')).toEqual({ label: 'UNA_DECISION_FUTURA', tone: 'neutral' });
  });
});

describe('STATUS_FILTER_OPTIONS', () => {
  it('incluye las 5 decisiones, DISCARDED entre ellas', () => {
    const values = STATUS_FILTER_OPTIONS.map((option) => option.value);
    expect(values).toContain('DISCARDED');
    expect(values.length).toBe(5);
  });

  it('DISCARDED tiene el label "Descartada" en las opciones de filtro', () => {
    const option = STATUS_FILTER_OPTIONS.find((item) => item.value === 'DISCARDED');
    expect(option?.label).toBe('Descartada');
  });
});
