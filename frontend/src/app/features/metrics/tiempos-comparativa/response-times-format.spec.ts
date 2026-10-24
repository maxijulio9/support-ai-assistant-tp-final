import { cohortLabel, firstResponseKindLabel, formatDuration, formatPercent, withinTargetLabel } from './response-times-format';

describe('formatDuration', () => {
  it.each([
    [0, '0 s'],
    [1, '1 s'],
    [45, '45 s'],
    [59, '59 s'],
    [60, '1 min'],
    [125, '2 min 5 s'],
    [600, '10 min'],
    [3599, '59 min 59 s'],
    [3600, '1 h'],
    [3900, '1 h 5 min'],
    [7384, '2 h 3 min'],
  ])('%s s se muestra como "%s"', (seconds, expected) => {
    expect(formatDuration(seconds)).toBe(expected);
  });

  it('redondea los segundos antes de dividir para no mostrar 60 s', () => {
    expect(formatDuration(59.6)).toBe('1 min');
    expect(formatDuration(3599.6)).toBe('1 h');
    expect(formatDuration(44.4)).toBe('44 s');
  });
});

describe('formatPercent', () => {
  it.each([
    [0, '0%'],
    [1, '100%'],
    [0.834, '83%'],
    [0.835, '84%'],
  ])('%s se muestra como "%s"', (rate, expected) => {
    expect(formatPercent(rate)).toBe(expected);
  });
});

describe('cohortLabel', () => {
  it('rotula las cinco cohortes', () => {
    expect(cohortLabel('automatic')).toBe('Automática');
    expect(cohortLabel('reviewed')).toBe('Con revisión');
    expect(cohortLabel('escalated')).toBe('Acuse de recibo');
    expect(cohortLabel('info_requested')).toBe('Pedido de información');
    expect(cohortLabel('baseline')).toBe('Atención manual previa');
  });

  it('en tablas angostas baseline pasa a "Previa" y el resto no cambia', () => {
    expect(cohortLabel('baseline', true)).toBe('Previa');
    expect(cohortLabel('automatic', true)).toBe('Automática');
  });

  it('una cohorte desconocida se muestra con su valor', () => {
    expect(cohortLabel('otra')).toBe('otra');
  });
});

describe('firstResponseKindLabel', () => {
  it('rotula los tres tipos de primera respuesta', () => {
    expect(firstResponseKindLabel('answer')).toBe('Respuesta');
    expect(firstResponseKindLabel('acknowledgment')).toBe('Acuse de recibo');
    expect(firstResponseKindLabel('information_request')).toBe('Pedido de información');
  });
});

describe('withinTargetLabel', () => {
  it('aclara el tipo de respuesta en escalated e info_requested', () => {
    expect(withinTargetLabel('escalated')).toBe('dentro del objetivo (acuse)');
    expect(withinTargetLabel('info_requested')).toBe('dentro del objetivo (pedido)');
  });

  it('en las demas cohortes no lleva aclaracion', () => {
    expect(withinTargetLabel('automatic')).toBe('dentro del objetivo');
    expect(withinTargetLabel('reviewed')).toBe('dentro del objetivo');
  });
});
