import { webhookSecretBlockView } from './webhook-secret-view';

describe('webhookSecretBlockView', () => {
  it('sin conexion guardada: el bloque no se muestra, aunque la marca diga otra cosa', () => {
    expect(webhookSecretBlockView({ connectionConfigured: false, secretConfigured: false, notFound: false })).toBe(
      'hidden',
    );
    expect(webhookSecretBlockView({ connectionConfigured: false, secretConfigured: true, notFound: false })).toBe(
      'hidden',
    );
  });

  it('conexion guardada y marca en false: sin secreto', () => {
    expect(webhookSecretBlockView({ connectionConfigured: true, secretConfigured: false, notFound: false })).toBe('no-secret');
  });

  it('conexion guardada y un 404 al pedirlo: sin secreto, aunque la marca diga true', () => {
    expect(webhookSecretBlockView({ connectionConfigured: true, secretConfigured: true, notFound: true })).toBe('no-secret');
  });

  it('conexion guardada, marca en true y sin 404: hay secreto', () => {
    expect(webhookSecretBlockView({ connectionConfigured: true, secretConfigured: true, notFound: false })).toBe('has-secret');
  });
});
