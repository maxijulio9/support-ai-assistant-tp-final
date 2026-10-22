import { contrastRatio, readableTextColorVar } from './decision-text-color';

const LIGHT_TEXT = '#ffffff';
const DARK_TEXT = '#181c1c';

describe('contrastRatio', () => {
  it('negro contra blanco da el maximo de la escala, 21:1', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0);
  });

  it('un color contra si mismo da 1:1', () => {
    expect(contrastRatio('#16a34a', '#16a34a')).toBeCloseTo(1, 5);
  });

  it('es simetrico: no importa el orden de los colores', () => {
    expect(contrastRatio('#16a34a', '#ffffff')).toBeCloseTo(contrastRatio('#ffffff', '#16a34a'), 10);
  });
});

describe('readableTextColorVar', () => {
  it('fondo claro: elige el texto oscuro', () => {
    // #16a34a (Publicada) da mas contraste contra el texto oscuro (5.22)
    // que contra el claro (3.30).
    expect(readableTextColorVar('#16a34a', LIGHT_TEXT, DARK_TEXT)).toBe('--mat-sys-on-surface');
  });

  it('fondo oscuro: elige el texto claro', () => {
    // #a21caf (Descartada) da mas contraste contra el texto claro (6.32)
    // que contra el oscuro (2.72).
    expect(readableTextColorVar('#a21caf', LIGHT_TEXT, DARK_TEXT)).toBe('--mat-sys-on-primary');
  });

  it('el gris de "Otras" elige el texto claro', () => {
    // #6b6e77 (Otras) da mas contraste contra el texto claro (5.09) que
    // contra el oscuro (3.37).
    expect(readableTextColorVar('#6b6e77', LIGHT_TEXT, DARK_TEXT)).toBe('--mat-sys-on-primary');
  });

  it('en cualquier caso, el elegido siempre llega a WCAG AA (4.5:1) para texto chico', () => {
    const backgrounds = ['#16a34a', '#d97706', '#dc2626', '#2563eb', '#a21caf', '#0891b2', '#6b6e77'];
    for (const background of backgrounds) {
      const chosen = readableTextColorVar(background, LIGHT_TEXT, DARK_TEXT);
      const chosenHex = chosen === '--mat-sys-on-primary' ? LIGHT_TEXT : DARK_TEXT;
      expect(contrastRatio(background, chosenHex)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
