import { HttpErrorResponse } from '@angular/common/http';
import {
  DEACTIVATE_DIALOG,
  activationAction,
  activationErrorMessage,
  activationSnackbarMessage,
  configProjectLabel,
  deactivateDialogTitle,
} from './project-activation';
import { INACTIVE_MARK } from '../../shared/project-activity';

const http = (status: number, body: unknown = null) => new HttpErrorResponse({ status, error: body });

describe('activationAction', () => {
  it('un proyecto activo se puede desactivar y pide confirmacion', () => {
    expect(activationAction({ is_active: true })).toEqual({ kind: 'deactivate', label: 'Desactivar', needsConfirmation: true });
  });

  it('un proyecto inactivo se puede activar, sin confirmacion', () => {
    expect(activationAction({ is_active: false })).toEqual({ kind: 'activate', label: 'Activar', needsConfirmation: false });
  });

  it('el texto nunca dice Eliminar ni Borrar', () => {
    for (const is_active of [true, false]) {
      expect(activationAction({ is_active }).label).not.toMatch(/eliminar|borrar/i);
    }
  });
});

describe('configProjectLabel', () => {
  it('activo: CLAVE - Nombre', () => {
    expect(configProjectLabel({ key: 'TARG', name: 'Soporte Argentina', is_active: true })).toBe('TARG - Soporte Argentina');
    expect(configProjectLabel({ key: 'TARG', name: 'Soporte Argentina' })).toBe('TARG - Soporte Argentina');
  });

  it('inactivo: la marca va despues del nombre', () => {
    expect(configProjectLabel({ key: 'TBRA', name: 'Suporte Brasil', is_active: false })).toBe(
      `TBRA - Suporte Brasil ${INACTIVE_MARK}`,
    );
  });
});

describe('activationSnackbarMessage', () => {
  it('desactivar con varias revisiones pendientes las cuenta en plural', () => {
    expect(activationSnackbarMessage('deactivate', 'Soporte Argentina', 3)).toBe(
      'Soporte Argentina desactivado. Quedan 3 revisiones pendientes.',
    );
  });

  it('con una sola va en singular', () => {
    expect(activationSnackbarMessage('deactivate', 'Soporte Argentina', 1)).toBe(
      'Soporte Argentina desactivado. Queda 1 revisión pendiente.',
    );
  });

  it('con 0 no menciona las revisiones', () => {
    expect(activationSnackbarMessage('deactivate', 'Soporte Argentina', 0)).toBe('Soporte Argentina desactivado.');
  });

  it.each([-2, Number.NaN, Number.POSITIVE_INFINITY])('un valor que no sirve (%s) se trata como 0', (value) => {
    expect(activationSnackbarMessage('deactivate', 'X', value)).toBe('X desactivado.');
  });

  it('activar no menciona revisiones, aunque el backend mande el numero', () => {
    expect(activationSnackbarMessage('activate', 'Soporte Argentina', 5)).toBe('Soporte Argentina activado.');
  });
});

describe('activationErrorMessage', () => {
  it('403 se resuelve por codigo, con el texto de cada accion', () => {
    expect(activationErrorMessage(http(403, { detail: 'x' }), 'deactivate')).toBe(
      'No tenés permiso para desactivar proyectos. Solo lo puede hacer un administrador.',
    );
    expect(activationErrorMessage(http(403), 'activate')).toBe(
      'No tenés permiso para activar proyectos. Solo lo puede hacer un administrador.',
    );
  });

  it.each([400, 503])('%s muestra el detail del backend', (status) => {
    expect(activationErrorMessage(http(status, { detail: 'El proyecto XYZ no existe' }), 'deactivate')).toBe(
      'El proyecto XYZ no existe',
    );
  });

  it('503 sin detail usa el texto fijo del servicio, y 400 sin detail el generico', () => {
    expect(activationErrorMessage(http(503, {}), 'activate')).toBe('El servicio no está disponible. Intentá de nuevo en unos minutos.');
    expect(activationErrorMessage(http(400, {}), 'deactivate')).toBe('No se pudo desactivar el proyecto. Intentá de nuevo.');
  });

  it.each([500, 0, 422])('el resto (%s) es el generico fijo, sin el detail', (status) => {
    expect(activationErrorMessage(http(status, { detail: 'interno' }), 'deactivate')).toBe(
      'No se pudo desactivar el proyecto. Intentá de nuevo.',
    );
    expect(activationErrorMessage(http(status, { detail: 'interno' }), 'activate')).toBe(
      'No se pudo activar el proyecto. Intentá de nuevo.',
    );
  });

  it('un error que no es HTTP tambien es el generico', () => {
    expect(activationErrorMessage(new Error('x'), 'activate')).toBe('No se pudo activar el proyecto. Intentá de nuevo.');
  });
});

describe('textos del dialogo de desactivar', () => {
  it('el titulo lleva el nombre del proyecto', () => {
    expect(deactivateDialogTitle('Soporte Argentina')).toBe('Desactivar Soporte Argentina');
  });

  it('explica que no se borra nada, que se ignoran tickets y comentarios nuevos, y que se puede revertir', () => {
    expect(DEACTIVATE_DIALOG.body).toContain('No se borra nada');
    expect(DEACTIVATE_DIALOG.body).toContain('tickets nuevos y sus comentarios nuevos');
    expect(DEACTIVATE_DIALOG.body).toContain('revisiones pendientes siguen disponibles');
    expect(DEACTIVATE_DIALOG.body).toContain('volver a activarlo');
    expect(DEACTIVATE_DIALOG.cancel).toBe('Cancelar');
    expect(DEACTIVATE_DIALOG.confirm).toBe('Desactivar');
  });
});
