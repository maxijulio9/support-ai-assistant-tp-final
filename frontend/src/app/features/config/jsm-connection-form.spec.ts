import { buildJsmConnectionRequest, statusAfterSave } from './jsm-connection-form';

describe('buildJsmConnectionRequest', () => {
  const values = { baseUrl: 'https://empresa.atlassian.net', userEmail: 'admin@empresa.com', apiToken: 'token-de-prueba' };

  it('manda la url, el email y el token', () => {
    expect(buildJsmConnectionRequest(values)).toEqual({
      base_url: 'https://empresa.atlassian.net',
      user_email: 'admin@empresa.com',
      api_token: 'token-de-prueba',
    });
  });

  it('no incluye la clave webhook_secret, ni siquiera con null', () => {
    const request = buildJsmConnectionRequest(values);

    expect(Object.keys(request)).not.toContain('webhook_secret');
    expect('webhook_secret' in request).toBe(false);
    expect(JSON.stringify(request)).not.toContain('webhook_secret');
  });

  it('el token se manda tal cual, sin recortar ni transformar', () => {
    expect(buildJsmConnectionRequest({ ...values, apiToken: '  abc  ' }).api_token).toBe('  abc  ');
  });
});

describe('statusAfterSave', () => {
  it('queda configurada, con la url y el email guardados y el secreto presente', () => {
    expect(statusAfterSave('https://empresa.atlassian.net', 'admin@empresa.com')).toEqual({
      base_url: 'https://empresa.atlassian.net',
      configured: true,
      user_email: 'admin@empresa.com',
      webhook_secret_configured: true,
    });
  });
});
