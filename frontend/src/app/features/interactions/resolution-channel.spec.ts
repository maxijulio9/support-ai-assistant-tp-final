import { resolutionChannelLabel } from './resolution-channel';

describe('resolutionChannelLabel', () => {
  it('null es "Sin resolver"', () => {
    expect(resolutionChannelLabel(null)).toBe('Sin resolver');
  });

  it('mapea los 5 canales existentes', () => {
    expect(resolutionChannelLabel('AUTO')).toBe('Automática');
    expect(resolutionChannelLabel('REVIEWED_APPROVED')).toBe('Aprobada por una persona');
    expect(resolutionChannelLabel('REVIEWED_REGENERATED')).toBe('Regenerada y aprobada');
    expect(resolutionChannelLabel('ESCALATED_BY_HUMAN')).toBe('Escalada por una persona');
    expect(resolutionChannelLabel('RESOLVED_EXTERNALLY')).toBe('Resuelta externamente');
  });

  it('mapea los 2 canales nuevos de CU24/CU25', () => {
    expect(resolutionChannelLabel('DISCARDED_BY_HUMAN')).toBe('Descartada por una persona');
    expect(resolutionChannelLabel('REVIEWED_EDITED')).toBe('Aprobada con edición');
  });

  it('un canal desconocido se muestra crudo, sin romper', () => {
    expect(resolutionChannelLabel('UN_CANAL_FUTURO')).toBe('UN_CANAL_FUTURO');
  });
});
