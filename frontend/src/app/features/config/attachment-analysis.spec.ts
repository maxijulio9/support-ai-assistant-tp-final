import { HttpErrorResponse } from '@angular/common/http';
import {
  ATTACHMENT_ANALYSIS_DIALOG,
  ATTACHMENT_ANALYSIS_PARAGRAPHS,
  ATTACHMENT_ANALYSIS_TITLE,
  IDLE_ATTACHMENT_ANALYSIS_STATE,
  attachmentAnalysisActionFor,
  attachmentAnalysisDialogProjectLine,
  attachmentAnalysisErrorMessage,
  attachmentAnalysisSnackbarMessage,
  attachmentAnalysisToggleState,
} from './attachment-analysis';

const http = (status: number, body: unknown = null) => new HttpErrorResponse({ status, error: body });

describe('textos del analisis de imagenes adjuntas', () => {
  const text = ATTACHMENT_ANALYSIS_PARAGRAPHS.join(' ');

  it('el titulo es el aprobado', () => {
    expect(ATTACHMENT_ANALYSIS_TITLE).toBe('Analizar imágenes adjuntas');
  });

  it('dice que es opcional y que viene apagada', () => {
    expect(text).toContain('Es una opción y viene apagada.');
  });

  it('dice que las imagenes se envian al proveedor del modelo configurado', () => {
    expect(text).toContain('las imágenes de los tickets nuevos se envían al proveedor del modelo configurado para describirlas');
  });

  it('avisa que las imagenes pueden mostrar datos personales o financieros y que el proveedor debe estar autorizado', () => {
    expect(ATTACHMENT_ANALYSIS_PARAGRAPHS).toContain(
      'Las imágenes pueden mostrar datos personales o financieros. Encendela solo si el proveedor del modelo está autorizado a recibirlos.',
    );
  });

  it('el aviso va despues de decir a donde se envian las imagenes', () => {
    const sent = ATTACHMENT_ANALYSIS_PARAGRAPHS.findIndex((paragraph) => paragraph.includes('se envían al proveedor'));
    const warning = ATTACHMENT_ANALYSIS_PARAGRAPHS.findIndex((paragraph) => paragraph.includes('datos personales o financieros'));
    expect(sent).toBeGreaterThanOrEqual(0);
    expect(warning).toBe(sent + 1);
  });

  it('dice los formatos y limites, y que los otros archivos se ignoran', () => {
    expect(text).toContain('Solo se leen archivos PNG o JPG, hasta 3 imágenes de 5 MB por ticket');
    expect(text).toContain('Los otros archivos se ignoran');
  });

  it('dice que la imagen no se guarda y que solo queda su descripcion en el registro', () => {
    expect(text).toContain('La imagen no se guarda: solo su descripción queda en el registro de la interacción.');
  });

  it('el dialogo usa Cancelar y Encender, y muestra el proyecto', () => {
    expect(ATTACHMENT_ANALYSIS_DIALOG).toEqual({ cancel: 'Cancelar', confirm: 'Encender' });
    expect(attachmentAnalysisDialogProjectLine('Soporte Argentina')).toBe('Proyecto: Soporte Argentina');
  });

  it('ningun texto lleva em dash, el caracter de separador, enlaces ni claves de ticket', () => {
    const all = [
      ATTACHMENT_ANALYSIS_TITLE,
      ...ATTACHMENT_ANALYSIS_PARAGRAPHS,
      attachmentAnalysisSnackbarMessage(true, 'X'),
      attachmentAnalysisSnackbarMessage(false, 'X'),
      attachmentAnalysisErrorMessage(http(403)),
      attachmentAnalysisErrorMessage(http(500)),
    ];
    for (const value of all) {
      expect(value).not.toContain(String.fromCharCode(0x2014));
      expect(value).not.toContain(String.fromCharCode(0xb7));
      expect(value).not.toMatch(/https?:|TF-\d/);
    }
  });
});

describe('attachmentAnalysisActionFor', () => {
  it('encender pide confirmacion', () => {
    expect(attachmentAnalysisActionFor(false, true)).toBe('ask-confirmation');
  });

  it('apagar guarda directo, sin dialogo', () => {
    expect(attachmentAnalysisActionFor(true, false)).toBe('save');
  });

  it('pedir el valor que ya tiene no hace nada', () => {
    expect(attachmentAnalysisActionFor(true, true)).toBe('none');
    expect(attachmentAnalysisActionFor(false, false)).toBe('none');
  });
});

describe('attachmentAnalysisToggleState', () => {
  it('sin pedido en curso muestra el valor guardado y no esta bloqueada', () => {
    expect(attachmentAnalysisToggleState(false, IDLE_ATTACHMENT_ANALYSIS_STATE)).toEqual({ checked: false, disabled: false });
    expect(attachmentAnalysisToggleState(true, IDLE_ATTACHMENT_ANALYSIS_STATE)).toEqual({ checked: true, disabled: false });
  });

  it('mientras guarda muestra el valor pedido y esta bloqueada', () => {
    expect(attachmentAnalysisToggleState(false, { desired: true, locked: true, error: null })).toEqual({
      checked: true,
      disabled: true,
    });
  });

  it('si el pedido falla vuelve al valor guardado', () => {
    expect(attachmentAnalysisToggleState(false, { desired: null, locked: false, error: 'x' })).toEqual({
      checked: false,
      disabled: false,
    });
  });
});

describe('attachmentAnalysisSnackbarMessage', () => {
  it('dice el estado en el que quedo y el proyecto', () => {
    expect(attachmentAnalysisSnackbarMessage(true, 'Soporte')).toBe(
      'Soporte: el sistema ahora analiza las imágenes adjuntas de los tickets nuevos.',
    );
    expect(attachmentAnalysisSnackbarMessage(false, 'Soporte')).toBe('Soporte: el sistema ya no analiza las imágenes adjuntas.');
  });
});

describe('attachmentAnalysisErrorMessage', () => {
  it('403 dice que solo lo puede hacer un administrador', () => {
    expect(attachmentAnalysisErrorMessage(http(403))).toBe(
      'No tenés permiso para cambiar esta opción. Solo lo puede hacer un administrador.',
    );
  });

  it('400 y 503 muestran el detail del backend', () => {
    expect(attachmentAnalysisErrorMessage(http(400, { detail: 'El proyecto no existe' }))).toBe('El proyecto no existe');
    expect(attachmentAnalysisErrorMessage(http(503, { detail: 'No se pudo cambiar el estado del proyecto' }))).toBe(
      'No se pudo cambiar el estado del proyecto',
    );
  });

  it('sin detail legible o con otro codigo cae en el mensaje fijo', () => {
    expect(attachmentAnalysisErrorMessage(http(500))).toBe('No se pudo cambiar la opción. Intentá de nuevo.');
    expect(attachmentAnalysisErrorMessage(http(400))).toBe('No se pudo cambiar la opción. Intentá de nuevo.');
    expect(attachmentAnalysisErrorMessage(new Error('x'))).toBe('No se pudo cambiar la opción. Intentá de nuevo.');
  });
});
