import {
  FRAGMENT_COLLAPSE_THRESHOLD,
  FRAGMENT_UNAVAILABLE,
  NEW_TAB_HINT,
  SOURCES_EMPTY,
  SOURCES_NOTE,
  SOURCES_TITLE,
  fragmentToggleContext,
  fragmentToggleLabel,
  hasFragment,
  isFragmentCollapsible,
  sourceLinkUrl,
  sourceSpaceLabel,
  sourceTrackKey,
} from './interaction-sources';

describe('textos de las fuentes', () => {
  it('son los textos pedidos', () => {
    expect(SOURCES_TITLE).toBe('Fuentes consultadas');
    expect(SOURCES_NOTE).toBe('Páginas de la base de conocimiento que el sistema consultó para generar la respuesta.');
    expect(SOURCES_EMPTY).toBe('No se consultó la base de conocimiento para esta solicitud o no hay fuentes guardadas.');
    expect(FRAGMENT_UNAVAILABLE).toBe('Fragmento no disponible');
    expect(NEW_TAB_HINT).toBe('(se abre en una pestaña nueva)');
  });

  it('no usan la palabra vedada, ni em dash, ni punto medio, ni claves de Jira', () => {
    const all = [SOURCES_TITLE, SOURCES_NOTE, SOURCES_EMPTY, FRAGMENT_UNAVAILABLE, NEW_TAB_HINT];
    for (const text of all) expect(text).not.toMatch(/cit[a]d|\u2014|\u00B7|[A-Z]{2,}-\d+/i);
  });
});

describe('sourceLinkUrl', () => {
  it('acepta https y devuelve la URL normalizada', () => {
    expect(sourceLinkUrl('https://acme.atlassian.net/wiki/spaces/KB/pages/1')).toBe(
      'https://acme.atlassian.net/wiki/spaces/KB/pages/1',
    );
  });

  it.each([
    ['http plano', 'http://acme.atlassian.net/wiki'],
    ['javascript', 'javascript:alert(1)'],
    ['data', 'data:text/html,<b>x</b>'],
    ['ftp', 'ftp://acme.atlassian.net/x'],
    ['relativa', '/wiki/spaces/KB'],
    ['sin esquema', 'acme.atlassian.net/wiki'],
    ['mal formada', 'https://'],
    ['vacía', ''],
    ['solo espacios', '   '],
  ])('rechaza %s', (_name, url) => {
    expect(sourceLinkUrl(url)).toBeNull();
  });

  it('rechaza https con usuario o contraseña embebidos', () => {
    expect(sourceLinkUrl('https://usuario:clave@acme.atlassian.net/wiki')).toBeNull();
    expect(sourceLinkUrl('https://usuario@acme.atlassian.net/wiki')).toBeNull();
    expect(sourceLinkUrl('https://:clave@acme.atlassian.net/wiki')).toBeNull();
  });

  it('null y undefined dan null', () => {
    expect(sourceLinkUrl(null)).toBeNull();
    expect(sourceLinkUrl(undefined)).toBeNull();
  });
});

describe('sourceSpaceLabel', () => {
  it('rotula con la clave', () => {
    expect(sourceSpaceLabel('TARG')).toBe('Espacio TARG');
  });

  it('sin clave, vacía o en blanco no hay rótulo', () => {
    expect(sourceSpaceLabel(null)).toBeNull();
    expect(sourceSpaceLabel(undefined)).toBeNull();
    expect(sourceSpaceLabel('')).toBeNull();
    expect(sourceSpaceLabel('  ')).toBeNull();
  });
});

describe('fragmento', () => {
  const longText = 'a'.repeat(FRAGMENT_COLLAPSE_THRESHOLD + 1);

  it('el umbral es de 220 caracteres', () => {
    expect(FRAGMENT_COLLAPSE_THRESHOLD).toBe(220);
  });

  it('hasFragment: null, vacío y en blanco son ausentes', () => {
    expect(hasFragment(null)).toBe(false);
    expect(hasFragment(undefined)).toBe(false);
    expect(hasFragment('')).toBe(false);
    expect(hasFragment('   ')).toBe(false);
    expect(hasFragment('texto')).toBe(true);
  });

  it('se recorta solo si supera el umbral', () => {
    expect(isFragmentCollapsible('a'.repeat(FRAGMENT_COLLAPSE_THRESHOLD))).toBe(false);
    expect(isFragmentCollapsible(longText)).toBe(true);
  });

  it('un fragmento largo sin espacios también se recorta', () => {
    expect(isFragmentCollapsible('x'.repeat(600))).toBe(true);
  });

  it('un fragmento de 600 caracteres con puntos suspensivos se recorta', () => {
    expect(isFragmentCollapsible('a'.repeat(599) + '…')).toBe(true);
  });

  it('los espacios de los bordes no cuentan para el umbral', () => {
    expect(isFragmentCollapsible(' '.repeat(50) + 'a'.repeat(FRAGMENT_COLLAPSE_THRESHOLD) + ' '.repeat(50))).toBe(false);
  });

  it('null, vacío y en blanco nunca se recortan', () => {
    expect(isFragmentCollapsible(null)).toBe(false);
    expect(isFragmentCollapsible('')).toBe(false);
    expect(isFragmentCollapsible('    ')).toBe(false);
  });
});

describe('botón Ver más', () => {
  it('cambia de etiqueta según el estado', () => {
    expect(fragmentToggleLabel(false)).toBe('Ver más');
    expect(fragmentToggleLabel(true)).toBe('Ver menos');
  });

  it('el contexto para lector de pantalla incluye el título tal cual', () => {
    expect(fragmentToggleContext('Sin título')).toBe(' sobre Sin título');
  });
});

describe('sourceTrackKey', () => {
  it('dos fuentes con el mismo título tienen claves distintas', () => {
    expect(sourceTrackKey('Guía de VPN', 0)).not.toBe(sourceTrackKey('Guía de VPN', 1));
  });

  it('la misma posición y título dan la misma clave', () => {
    expect(sourceTrackKey('Guía', 2)).toBe(sourceTrackKey('Guía', 2));
  });
});
