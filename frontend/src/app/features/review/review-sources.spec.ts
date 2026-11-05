import { isSourcesFoldable, sourcesToggleTitle } from './review-sources';

describe('sourcesToggleTitle', () => {
  it('lleva el titulo fijo y la cantidad', () => {
    expect(sourcesToggleTitle(8)).toBe('Fuentes consultadas (8)');
    expect(sourcesToggleTitle(1)).toBe('Fuentes consultadas (1)');
  });
});

describe('isSourcesFoldable', () => {
  it('con fuentes se pliega, sin fuentes no', () => {
    expect(isSourcesFoldable(3)).toBe(true);
    expect(isSourcesFoldable(0)).toBe(false);
  });
});
