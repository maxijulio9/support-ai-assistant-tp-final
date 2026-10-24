import {
  MIN_FIRST_RESPONSE_TARGET_SECONDS,
  firstResponseTargetError,
  formatFirstResponseTarget,
} from './first-response-target';

describe('firstResponseTargetError', () => {
  it('un entero valido no tiene error', () => {
    expect(firstResponseTargetError(30)).toBeNull();
    expect(firstResponseTargetError(120)).toBeNull();
  });

  it('el minimo de 1 segundo es valido', () => {
    expect(MIN_FIRST_RESPONSE_TARGET_SECONDS).toBe(1);
    expect(firstResponseTargetError(1)).toBeNull();
  });

  it('un valor grande es valido: el contrato no define maximo', () => {
    expect(firstResponseTargetError(86400)).toBeNull();
  });

  it('vacio es requerido', () => {
    expect(firstResponseTargetError(null)).toBe('required');
    expect(firstResponseTargetError(Number.NaN)).toBe('required');
  });

  it('cero y negativos quedan por debajo del minimo', () => {
    expect(firstResponseTargetError(0)).toBe('min');
    expect(firstResponseTargetError(-5)).toBe('min');
  });

  it('un decimal no es entero', () => {
    expect(firstResponseTargetError(30.5)).toBe('integer');
    expect(firstResponseTargetError(0.5)).toBe('integer');
  });
});

describe('formatFirstResponseTarget', () => {
  it('muestra los segundos con la unidad', () => {
    expect(formatFirstResponseTarget(30)).toBe('30 s');
    expect(formatFirstResponseTarget(1)).toBe('1 s');
  });
});
