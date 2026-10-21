import { HttpErrorResponse } from '@angular/common/http';
import { classifyReviewError } from './review-errors';

function httpError(status: number): HttpErrorResponse {
  return new HttpErrorResponse({ status });
}

describe('classifyReviewError', () => {
  it('404 es not-found', () => {
    expect(classifyReviewError(httpError(404))).toBe('not-found');
  });

  it('403 es forbidden', () => {
    expect(classifyReviewError(httpError(403))).toBe('forbidden');
  });

  it('409 es conflict', () => {
    expect(classifyReviewError(httpError(409))).toBe('conflict');
  });

  it('422 es validation', () => {
    expect(classifyReviewError(httpError(422))).toBe('validation');
  });

  it('0 (sin conexion) es network', () => {
    expect(classifyReviewError(httpError(0))).toBe('network');
  });

  it('500 y mayores son server', () => {
    expect(classifyReviewError(httpError(500))).toBe('server');
    expect(classifyReviewError(httpError(503))).toBe('server');
  });

  it('un status no mapeado es unknown', () => {
    expect(classifyReviewError(httpError(418))).toBe('unknown');
  });

  it('algo que no es un HttpErrorResponse es unknown', () => {
    expect(classifyReviewError(new Error('otra cosa'))).toBe('unknown');
    expect(classifyReviewError(null)).toBe('unknown');
  });
});
