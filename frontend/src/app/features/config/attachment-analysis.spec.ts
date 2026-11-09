import { HttpErrorResponse } from '@angular/common/http';
import {
  ATTACHMENT_ANALYSIS_DIALOG,
  ATTACHMENT_ANALYSIS_INTRO,
  ATTACHMENT_ANALYSIS_SECTIONS,
  ATTACHMENT_ANALYSIS_TITLE,
  IDLE_ATTACHMENT_ANALYSIS_STATE,
  attachmentAnalysisActionFor,
  attachmentAnalysisDialogProjectLine,
  attachmentAnalysisErrorMessage,
  attachmentAnalysisSnackbarMessage,
  attachmentAnalysisToggleLabel,
  attachmentAnalysisToggleState,
} from './attachment-analysis';

const http = (status: number, body: unknown = null) => new HttpErrorResponse({ status, error: body });

describe('textos del analisis de imagenes adjuntas', () => {
  const items = (title: string) => ATTACHMENT_ANALYSIS_SECTIONS.find((section) => section.title === title)?.items ?? [];

  it('el titulo es el aprobado', () => {
    expect(ATTACHMENT_ANALYSIS_TITLE).toBe('Analizar imágenes adjuntas');
  });

  it('la introduccion dice que es opcional, que viene apagada y para que se usan las imagenes', () => {
    expect(ATTACHMENT_ANALYSIS_INTRO).toBe(
      'Es una opción y viene apagada. Si la encendés, el sistema lee las imágenes de los tickets nuevos y usa lo que ve para entender mejor el problema y responder.',
    );
  });

  it('tiene las tres secciones aprobadas, en orden', () => {
    expect(ATTACHMENT_ANALYSIS_SECTIONS.map((section) => section.title)).toEqual([
      'Qué pasa con las imágenes',
      'Qué se analiza',
      'Qué tener en cuenta antes de encenderla',
    ]);
  });

  it('que pasa con las imagenes: proveedor, datos sensibles y que no se guardan', () => {
    expect(items('Qué pasa con las imágenes')).toEqual([
      'Se envían al proveedor del modelo configurado para que las describa.',
      'Pueden mostrar datos personales o financieros. Encendela solo si el proveedor está autorizado a recibirlos.',
      'La imagen no se guarda: solo su descripción queda en el registro de la interacción.',
    ]);
  });

  it('que se analiza: formatos y limites, solo tickets nuevos y que pasa si no se puede leer', () => {
    expect(items('Qué se analiza')).toEqual([
      'Solo archivos PNG o JPG, hasta 3 imágenes de 5 MB por ticket. Los otros archivos se ignoran.',
      'Solo los tickets nuevos. Las imágenes que llegan en comentarios posteriores no se leen.',
      'Si una imagen no se puede leer o no aporta información, el sistema responde con el texto del ticket.',
    ]);
  });

  it('que tener en cuenta: demora, costo, imprecision y desde cuando aplica', () => {
    expect(items('Qué tener en cuenta antes de encenderla')).toEqual([
      'Cada ticket nuevo con imágenes suma una consulta extra al modelo, así que la primera respuesta puede tardar algunos segundos más.',
      'Aumenta el consumo de tokens y el costo del proveedor, en proporción a la cantidad de imágenes.',
      'La descripción la genera el modelo, así que puede ser imprecisa. Conviene revisar las respuestas de los primeros tickets.',
      'Se aplica a los tickets que lleguen desde que la encendés. Podés apagarla cuando quieras.',
    ]);
  });

  it('el dialogo usa Cancelar y Activar, y muestra el proyecto', () => {
    expect(ATTACHMENT_ANALYSIS_DIALOG).toEqual({ cancel: 'Cancelar', confirm: 'Activar' });
    expect(attachmentAnalysisDialogProjectLine('Soporte Argentina')).toBe('Proyecto: Soporte Argentina');
  });

  it('cada llave tiene un nombre accesible con el proyecto', () => {
    expect(attachmentAnalysisToggleLabel('Soporte Argentina')).toBe('Analizar imágenes adjuntas de Soporte Argentina');
  });

  it('ningun texto lleva em dash, el caracter de separador, enlaces ni claves de ticket', () => {
    const all = [
      ATTACHMENT_ANALYSIS_TITLE,
      ATTACHMENT_ANALYSIS_INTRO,
      ...ATTACHMENT_ANALYSIS_SECTIONS.flatMap((section) => [section.title, ...section.items]),
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
    expect(attachmentAnalysisToggleState(false, { desired: true, locked: true })).toEqual({
      checked: true,
      disabled: true,
    });
  });

  it('si el pedido falla vuelve al valor guardado', () => {
    expect(attachmentAnalysisToggleState(false, { desired: null, locked: false })).toEqual({
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
