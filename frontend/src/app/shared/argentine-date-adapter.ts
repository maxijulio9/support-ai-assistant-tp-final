import { Injectable } from '@angular/core';
import { NativeDateAdapter } from '@angular/material/core';
import { parseArgentineDate } from './parse-argentine-date';

// El adaptador nativo lee lo escrito con Date.parse, que toma "3/11/2026"
// como mes/dia. Aca se lee dia/mes/año; el resto (formato de lo que se
// muestra, calendario) sigue siendo el del idioma configurado.
@Injectable()
export class ArgentineDateAdapter extends NativeDateAdapter {
  override parse(value: unknown, parseFormat?: unknown): Date | null {
    if (typeof value === 'string') {
      const text = value.trim();
      if (text === '') return null;
      return parseArgentineDate(text) ?? this.invalid();
    }
    return super.parse(value, parseFormat);
  }
}
