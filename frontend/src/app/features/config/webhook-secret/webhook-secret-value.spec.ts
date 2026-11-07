import { toSecretValue } from './webhook-secret-value';

describe('toSecretValue', () => {
  it('masked ausente se trata como false, el default del contrato', () => {
    expect(toSecretValue({ webhook_secret: 'abc' })).toEqual({ value: 'abc', masked: false });
  });

  it('masked true se conserva', () => {
    expect(toSecretValue({ webhook_secret: '********abcd', masked: true })).toEqual({ value: '********abcd', masked: true });
  });

  it('masked false se conserva', () => {
    expect(toSecretValue({ webhook_secret: 'abc', masked: false })).toEqual({ value: 'abc', masked: false });
  });

  it('un valor vacio pasa tal cual: la pantalla decide como mostrarlo', () => {
    expect(toSecretValue({ webhook_secret: '' })).toEqual({ value: '', masked: false });
    expect(toSecretValue({ webhook_secret: '', masked: true })).toEqual({ value: '', masked: true });
  });
});
