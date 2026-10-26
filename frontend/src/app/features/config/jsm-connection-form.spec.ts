import {
  API_TOKEN_HINTS,
  NO_SAVED_CONNECTION,
  SavedJsmConnection,
  apiTokenRequirement,
  buildJsmConnectionRequest,
  hasApiToken,
  normalizeBaseUrl,
  normalizeEmail,
  statusAfterSave,
} from './jsm-connection-form';

const SAVED: SavedJsmConnection = { configured: true, baseUrl: 'https://empresa.atlassian.net', userEmail: 'admin@empresa.com' };
const same = { baseUrl: 'https://empresa.atlassian.net', userEmail: 'admin@empresa.com' };

describe('normalizeBaseUrl y normalizeEmail', () => {
  it('la URL se recorta, pasa a minusculas y pierde todas las barras finales', () => {
    expect(normalizeBaseUrl('  HTTPS://Empresa.Atlassian.NET///  ')).toBe('https://empresa.atlassian.net');
    expect(normalizeBaseUrl('https://empresa.atlassian.net/wiki/')).toBe('https://empresa.atlassian.net/wiki');
  });

  it('solo se sacan las barras del final, no las del medio', () => {
    expect(normalizeBaseUrl('https://a.net//x//')).toBe('https://a.net//x');
  });

  it('el correo se recorta y pasa a minusculas', () => {
    expect(normalizeEmail('  Admin@Empresa.COM ')).toBe('admin@empresa.com');
  });
});

describe('apiTokenRequirement', () => {
  it('sin conexion guardada el token es obligatorio, sean cuales sean los valores', () => {
    expect(apiTokenRequirement(NO_SAVED_CONNECTION, same)).toBe('no-connection');
    expect(apiTokenRequirement({ ...SAVED, configured: false }, same)).toBe('no-connection');
  });

  it('configurada pero sin URL o correo guardados tambien cuenta como sin conexion', () => {
    expect(apiTokenRequirement({ configured: true, baseUrl: null, userEmail: 'a@b.c' }, same)).toBe('no-connection');
    expect(apiTokenRequirement({ configured: true, baseUrl: 'https://x.net', userEmail: null }, same)).toBe('no-connection');
    expect(apiTokenRequirement({ configured: true, baseUrl: '  ', userEmail: 'a@b.c' }, same)).toBe('no-connection');
  });

  it('los mismos valores guardados dejan el token opcional', () => {
    expect(apiTokenRequirement(SAVED, same)).toBe('optional');
  });

  it('la URL con otra capitalizacion cuenta como sin cambios', () => {
    expect(apiTokenRequirement(SAVED, { ...same, baseUrl: 'HTTPS://Empresa.Atlassian.Net' })).toBe('optional');
  });

  it('la URL con una o varias barras finales cuenta como sin cambios', () => {
    expect(apiTokenRequirement(SAVED, { ...same, baseUrl: 'https://empresa.atlassian.net/' })).toBe('optional');
    expect(apiTokenRequirement(SAVED, { ...same, baseUrl: 'https://empresa.atlassian.net///' })).toBe('optional');
  });

  it('lo guardado con barra final contra lo escrito sin ella tambien es sin cambios', () => {
    const saved = { ...SAVED, baseUrl: 'https://empresa.atlassian.net/' };
    expect(apiTokenRequirement(saved, same)).toBe('optional');
  });

  it('los espacios alrededor no cuentan como cambio', () => {
    expect(apiTokenRequirement(SAVED, { baseUrl: '  https://empresa.atlassian.net ', userEmail: ' admin@empresa.com  ' })).toBe('optional');
  });

  it('el correo con otra capitalizacion cuenta como sin cambios', () => {
    expect(apiTokenRequirement(SAVED, { ...same, userEmail: 'Admin@EMPRESA.com' })).toBe('optional');
  });

  it('otra URL cuenta como cambio', () => {
    expect(apiTokenRequirement(SAVED, { ...same, baseUrl: 'https://otra.atlassian.net' })).toBe('changed');
  });

  it('otro camino en la URL cuenta como cambio', () => {
    expect(apiTokenRequirement(SAVED, { ...same, baseUrl: 'https://empresa.atlassian.net/otro' })).toBe('changed');
  });

  it('otro correo cuenta como cambio', () => {
    expect(apiTokenRequirement(SAVED, { ...same, userEmail: 'otra@empresa.com' })).toBe('changed');
  });

  it('cambiar los dos tambien es cambio', () => {
    expect(apiTokenRequirement(SAVED, { baseUrl: 'https://otra.atlassian.net', userEmail: 'otra@empresa.com' })).toBe('changed');
  });

  it('un campo vacio cuenta como cambio', () => {
    expect(apiTokenRequirement(SAVED, { ...same, baseUrl: '' })).toBe('changed');
    expect(apiTokenRequirement(SAVED, { ...same, userEmail: '   ' })).toBe('changed');
  });

  it('volver al valor guardado vuelve a dejar el token opcional', () => {
    expect(apiTokenRequirement(SAVED, { ...same, baseUrl: 'https://otra.atlassian.net' })).toBe('changed');
    expect(apiTokenRequirement(SAVED, same)).toBe('optional');
  });
});

describe('hasApiToken', () => {
  it('vacio y solo espacios cuentan como ausente, y cualquier otro texto como presente', () => {
    expect(hasApiToken('')).toBe(false);
    expect(hasApiToken('   \t ')).toBe(false);
    expect(hasApiToken('abc')).toBe(true);
    expect(hasApiToken('  abc  ')).toBe(true);
  });
});

describe('API_TOKEN_HINTS', () => {
  it('tiene el texto de cada caso', () => {
    expect(API_TOKEN_HINTS.optional).toBe('Guardado. Dejalo vacío para conservarlo o ingresá uno nuevo para reemplazarlo.');
    expect(API_TOKEN_HINTS.changed).toBe('Cambiaste la URL o el correo, así que hay que ingresar el API token de nuevo.');
    expect(API_TOKEN_HINTS['no-connection']).toBe('Generalo desde tu cuenta de Atlassian.');
  });

  it('el de sin conexion es solo texto, sin enlaces', () => {
    expect(API_TOKEN_HINTS['no-connection']).not.toMatch(/https?:|<a|www\./i);
  });
});

describe('buildJsmConnectionRequest', () => {
  const values = { baseUrl: 'https://Empresa.atlassian.net/', userEmail: 'Admin@Empresa.com', apiToken: 'token-de-prueba' };

  it('manda la URL, el correo y el token', () => {
    expect(buildJsmConnectionRequest(values)).toEqual({
      base_url: 'https://Empresa.atlassian.net/',
      user_email: 'Admin@Empresa.com',
      api_token: 'token-de-prueba',
    });
  });

  it('recorta los espacios pero no cambia mayusculas ni quita barras', () => {
    const request = buildJsmConnectionRequest({ baseUrl: '  HTTPS://Empresa.Atlassian.net//  ', userEmail: '  Admin@Empresa.COM ', apiToken: 'x' });

    expect(request.base_url).toBe('HTTPS://Empresa.Atlassian.net//');
    expect(request.user_email).toBe('Admin@Empresa.COM');
  });

  it('un token con espacios alrededor se recorta antes de enviarlo', () => {
    expect(buildJsmConnectionRequest({ ...values, apiToken: '  token-de-prueba \n' }).api_token).toBe('token-de-prueba');
  });

  it.each(['', '   ', '\t\n'])('un token vacio o con solo espacios (%j) se omite: no hay clave api_token', (apiToken) => {
    const request = buildJsmConnectionRequest({ ...values, apiToken });

    expect('api_token' in request).toBe(false);
    expect(Object.keys(request)).toEqual(['base_url', 'user_email']);
    expect(JSON.stringify(request)).not.toContain('api_token');
  });

  it('no incluye nunca la clave webhook_secret', () => {
    for (const apiToken of ['', 'token']) {
      const request = buildJsmConnectionRequest({ ...values, apiToken });
      expect('webhook_secret' in request).toBe(false);
      expect(JSON.stringify(request)).not.toContain('webhook_secret');
    }
  });
});

describe('statusAfterSave', () => {
  it('queda configurada, con la URL y el correo guardados y el secreto presente', () => {
    expect(statusAfterSave('https://empresa.atlassian.net', 'admin@empresa.com')).toEqual({
      base_url: 'https://empresa.atlassian.net',
      configured: true,
      user_email: 'admin@empresa.com',
      webhook_secret_configured: true,
    });
  });
});
