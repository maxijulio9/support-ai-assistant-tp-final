import { resolveConfigTabIndex } from './config-tabs';

describe('resolveConfigTabIndex', () => {
  it('devuelve el indice de una key valida', () => {
    expect(resolveConfigTabIndex('confluence')).toBe(3);
  });

  it('cae en JSM (indice 0) con una key invalida', () => {
    expect(resolveConfigTabIndex('no-existe')).toBe(0);
  });

  it('cae en JSM (indice 0) sin ninguna key', () => {
    expect(resolveConfigTabIndex(null)).toBe(0);
  });
});
