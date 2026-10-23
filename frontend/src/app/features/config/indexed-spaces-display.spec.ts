import {
  indexedSpaceCountryLabel,
  indexedSpaceDescriptionLabel,
  indexedSpaceLanguageLabel,
  indexedSpaceLastUpdatedLabel,
} from './indexed-spaces-display';
import { formatIndexingTimestamp } from './indexing-status-display';

describe('indexedSpaceCountryLabel', () => {
  it('devuelve el codigo cuando hay uno', () => {
    expect(indexedSpaceCountryLabel('AR')).toBe('AR');
  });

  it('"Sin país" cuando es null, por ejemplo un espacio transversal', () => {
    expect(indexedSpaceCountryLabel(null)).toBe('Sin país');
  });
});

describe('indexedSpaceLanguageLabel', () => {
  it('devuelve el codigo cuando hay uno', () => {
    expect(indexedSpaceLanguageLabel('es')).toBe('es');
  });

  it('"Sin idioma" cuando es null', () => {
    expect(indexedSpaceLanguageLabel(null)).toBe('Sin idioma');
  });
});

describe('indexedSpaceDescriptionLabel', () => {
  it('devuelve la descripcion cuando hay una', () => {
    expect(indexedSpaceDescriptionLabel('Espacio de soporte')).toBe('Espacio de soporte');
  });

  it('"Sin descripción" cuando es null', () => {
    expect(indexedSpaceDescriptionLabel(null)).toBe('Sin descripción');
  });
});

describe('indexedSpaceLastUpdatedLabel', () => {
  it('"Nunca" cuando el espacio nunca se indexo', () => {
    expect(indexedSpaceLastUpdatedLabel(null)).toBe('Nunca');
  });

  it('formatea la fecha cuando hay una', () => {
    const value = '2024-01-01T00:00:00Z';
    expect(indexedSpaceLastUpdatedLabel(value)).toBe(formatIndexingTimestamp(value));
  });
});
