import { HttpErrorResponse } from '@angular/common/http';
import {
  CLIPBOARD_NOTE,
  CONFLUENCE_HELP,
  CONNECTION_NOT_SAVED_TEXT,
  COPY_FAILED_MESSAGE,
  JIRA_HELP,
  REGENERATE_DIALOG,
  SECRET_VISIBLE_MS,
  UNCONFIRMED_FIRST_MESSAGE,
  UNCONFIRMED_REGENERATE_MESSAGE,
  webhookSecretError,
} from './webhook-secret-messages';

const http = (status: number, body: unknown = null) => new HttpErrorResponse({ status, error: body });

describe('webhookSecretError al pedir el secreto (ver y copiar)', () => {
  it.each(['reveal', 'copy'] as const)('%s: un 404 significa que todavia no hay secreto', (action) => {
    expect(webhookSecretError(http(404), action)).toEqual({ kind: 'not-configured' });
  });

  it.each(['reveal', 'copy'] as const)('%s: 403, 503, red y otros tienen su mensaje', (action) => {
    expect(webhookSecretError(http(403), action)).toEqual({
      kind: 'error',
      message: 'No tenés permiso para ver el secreto. Solo lo puede ver un administrador.',
    });
    expect(webhookSecretError(http(503), action)).toEqual({
      kind: 'error',
      message: 'El servicio no está disponible. Intentá de nuevo en unos minutos.',
    });
    expect(webhookSecretError(http(0), action)).toEqual({
      kind: 'error',
      message: 'No pudimos conectarnos con el servidor. Revisá tu conexión e intentá de nuevo.',
    });
    expect(webhookSecretError(http(500), action)).toEqual({
      kind: 'error',
      message: 'Ocurrió un error inesperado. Intentá de nuevo.',
    });
  });

  it('un error que no es HTTP cae en el mensaje generico', () => {
    expect(webhookSecretError(new Error('x'), 'reveal')).toEqual({
      kind: 'error',
      message: 'Ocurrió un error inesperado. Intentá de nuevo.',
    });
  });
});

describe('webhookSecretError al regenerar', () => {
  it('un 404 al regenerar no es "sin secreto": es un error', () => {
    expect(webhookSecretError(http(404), 'regenerate').kind).toBe('error');
  });

  it('403 tiene su mensaje de permiso', () => {
    expect(webhookSecretError(http(403), 'regenerate')).toEqual({
      kind: 'error',
      message: 'No tenés permiso para regenerar el secreto. Solo lo puede hacer un administrador.',
    });
  });

  it.each([0, 500, 502, 503])('con estado %s no se puede confirmar el cambio y se pide comprobar con Ver', (status) => {
    expect(webhookSecretError(http(status), 'regenerate')).toEqual({ kind: 'error', message: UNCONFIRMED_REGENERATE_MESSAGE });
    expect(UNCONFIRMED_REGENERATE_MESSAGE).toBe('No pudimos confirmar el cambio. Pedí el secreto con «Ver» para comprobar el actual.');
  });

  it('la primera generacion no manda a "Ver", que todavia no existe', () => {
    expect(webhookSecretError(http(0), 'regenerate', false)).toEqual({ kind: 'error', message: UNCONFIRMED_FIRST_MESSAGE });
    expect(UNCONFIRMED_FIRST_MESSAGE).not.toContain('«Ver»');
  });

  it('otro error 4xx cae en el mensaje generico de regenerar', () => {
    expect(webhookSecretError(http(400), 'regenerate')).toEqual({
      kind: 'error',
      message: 'No se pudo regenerar el secreto. Intentá de nuevo.',
    });
  });
});

describe('seguridad de los mensajes', () => {
  const SECRET = 'valor-secreto-de-prueba';
  const bodies: unknown[] = [{ detail: SECRET }, { webhook_secret: SECRET }, SECRET, { detail: [{ msg: SECRET }] }];

  it.each([400, 403, 404, 500, 503, 0])('con estado %s ningun mensaje incluye el cuerpo de la respuesta', (status) => {
    for (const action of ['reveal', 'copy', 'regenerate'] as const) {
      for (const body of bodies) {
        const result = webhookSecretError(http(status, body), action);
        expect(JSON.stringify(result)).not.toContain(SECRET);
      }
    }
  });
});

describe('textos fijos', () => {
  it('la ayuda dice donde pegarlo en Jira y en Confluence', () => {
    expect(JIRA_HELP).toContain('Administración, Sistema, Webhooks');
    expect(JIRA_HELP).toContain('Secret');
    expect(JIRA_HELP).toContain('creación de ticket y de comentario');
    expect(CONFLUENCE_HELP).toContain('X-Webhook-Secret');
    expect(CONFLUENCE_HELP).toContain('Automation');
  });

  it('la ayuda avisa que el portapapeles del sistema lo conserva', () => {
    expect(CLIPBOARD_NOTE).toContain('portapapeles del sistema');
    expect(CLIPBOARD_NOTE).toContain('conserva');
  });

  it('la confirmacion avisa del 401 y de actualizar Jira y Confluence enseguida', () => {
    expect(REGENERATE_DIALOG.body).toContain('401');
    expect(REGENERATE_DIALOG.body).toContain('Jira y en Confluence');
    expect(REGENERATE_DIALOG.body).toContain('deja de valer enseguida');
    expect(REGENERATE_DIALOG.cancel).toBe('Cancelar');
    expect(REGENERATE_DIALOG.confirm).toBe('Regenerar');
  });

  it('textos aprobados', () => {
    expect(CONNECTION_NOT_SAVED_TEXT).toBe('El secreto se genera al guardar la conexión.');
    expect(COPY_FAILED_MESSAGE).toBe('No se pudo copiar. Mostralo y copialo a mano.');
  });

  it('el tiempo de visibilidad y de retencion es de 30 s', () => {
    expect(SECRET_VISIBLE_MS).toBe(30_000);
  });
});
