import { STATUS_FILTER_OPTIONS, decisionStatus, originalDecisionText } from './interaction-status';

describe('decisionStatus', () => {
  it('mapea las decisiones de uso diario', () => {
    expect(decisionStatus('AUTO_PUBLISH')).toEqual({ label: 'Publicada', tone: 'success' });
    expect(decisionStatus('NEEDS_REVIEW')).toEqual({ label: 'Pendiente de revisión', tone: 'warning' });
    expect(decisionStatus('ESCALATE')).toEqual({ label: 'Escalada', tone: 'error' });
    expect(decisionStatus('REQUEST_INFO')).toEqual({ label: 'Información solicitada', tone: 'neutral' });
  });

  it('DISCARDED se muestra como "Descartada" en tono neutral', () => {
    expect(decisionStatus('DISCARDED')).toEqual({ label: 'Descartada', tone: 'neutral' });
  });

  it('decision null usa el rotulo neutro "Sin decisión", no texto crudo', () => {
    expect(decisionStatus(null)).toEqual({ label: 'Sin decisión', tone: 'neutral' });
  });

  it('PUBLISH_FAILED se muestra como "Falló la publicación" con ícono, en un tono propio', () => {
    expect(decisionStatus('PUBLISH_FAILED')).toEqual({ label: 'Falló la publicación', tone: 'failed', icon: 'error_outline' });
    expect(decisionStatus('PUBLISH_FAILED').tone).not.toBe(decisionStatus('ESCALATE').tone);
    expect(decisionStatus('PUBLISH_FAILED').tone).not.toBe(decisionStatus('AUTO_PUBLISH').tone);
  });

  it('RESOLVED y RESOLVED_EXTERNALLY comparten el tono de resueltas', () => {
    expect(decisionStatus('RESOLVED')).toEqual({ label: 'Resuelta', tone: 'resolved' });
    expect(decisionStatus('RESOLVED_EXTERNALLY')).toEqual({ label: 'Resuelta externamente', tone: 'resolved' });
  });

  it('una decision desconocida se muestra legible y en tono neutral, sin romper', () => {
    expect(decisionStatus('UNA_DECISION_FUTURA')).toEqual({ label: 'Una decision futura', tone: 'neutral' });
    expect(decisionStatus('publish-timeout')).toEqual({ label: 'Publish timeout', tone: 'neutral' });
  });

  it('una decision vacia usa el rotulo "Sin decisión"', () => {
    expect(decisionStatus('')).toEqual({ label: 'Sin decisión', tone: 'neutral' });
    expect(decisionStatus('  _ ')).toEqual({ label: 'Sin decisión', tone: 'neutral' });
  });
});

describe('originalDecisionText', () => {
  it('muestra la decision original cuando difiere de la final', () => {
    expect(originalDecisionText('PUBLISH_FAILED', 'AUTO_PUBLISH')).toBe('Decisión original del sistema: Publicada');
  });

  it('usa el rotulo legible si la decision original es desconocida', () => {
    expect(originalDecisionText('PUBLISH_FAILED', 'NUEVA_DECISION')).toBe('Decisión original del sistema: Nueva decision');
  });

  it('no muestra nada si coinciden o no hay decision original', () => {
    expect(originalDecisionText('AUTO_PUBLISH', 'AUTO_PUBLISH')).toBeNull();
    expect(originalDecisionText('AUTO_PUBLISH', null)).toBeNull();
  });
});

describe('STATUS_FILTER_OPTIONS', () => {
  it('incluye las 8 decisiones, con las resueltas y PUBLISH_FAILED', () => {
    const values = STATUS_FILTER_OPTIONS.map((option) => option.value);
    expect(values).toContain('DISCARDED');
    expect(values).toContain('PUBLISH_FAILED');
    expect(values).toContain('RESOLVED');
    expect(values).toContain('RESOLVED_EXTERNALLY');
    expect(values.length).toBe(8);
  });

  it('PUBLISH_FAILED tiene el label "Falló la publicación" en el filtro', () => {
    expect(STATUS_FILTER_OPTIONS.find((item) => item.value === 'PUBLISH_FAILED')?.label).toBe('Falló la publicación');
  });

  it('DISCARDED tiene el label "Descartada" en las opciones de filtro', () => {
    const option = STATUS_FILTER_OPTIONS.find((item) => item.value === 'DISCARDED');
    expect(option?.label).toBe('Descartada');
  });
});
