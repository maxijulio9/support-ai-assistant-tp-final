import { HttpErrorResponse } from '@angular/common/http';
import { classifyReviewError, reviewErrorDetail } from './review-errors';

function httpError(status: number, body?: unknown): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: body });
}

describe('classifyReviewError', () => {
  it('404 es not-found', () => {
    expect(classifyReviewError(httpError(404))).toBe('not-found');
  });

  it('403 es forbidden', () => {
    expect(classifyReviewError(httpError(403))).toBe('forbidden');
  });

  it('400 es bad-request', () => {
    expect(classifyReviewError(httpError(400))).toBe('bad-request');
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

  it('503 es unavailable, aparte del resto de los 5xx', () => {
    expect(classifyReviewError(httpError(503))).toBe('unavailable');
  });

  it('500 y el resto de los 5xx son server', () => {
    expect(classifyReviewError(httpError(500))).toBe('server');
    expect(classifyReviewError(httpError(502))).toBe('server');
    expect(classifyReviewError(httpError(504))).toBe('server');
  });

  it('un status no mapeado es unknown', () => {
    expect(classifyReviewError(httpError(418))).toBe('unknown');
  });

  it('algo que no es un HttpErrorResponse es unknown', () => {
    expect(classifyReviewError(new Error('otra cosa'))).toBe('unknown');
    expect(classifyReviewError(null)).toBe('unknown');
  });
});

describe('reviewErrorDetail', () => {
  it('devuelve el detail cuando viene como string', () => {
    expect(reviewErrorDetail(httpError(400, { detail: 'El texto no puede quedar vacío' }))).toBe(
      'El texto no puede quedar vacío',
    );
  });

  it('null si no hay body o no trae detail', () => {
    expect(reviewErrorDetail(httpError(400))).toBeNull();
    expect(reviewErrorDetail(httpError(400, {}))).toBeNull();
  });

  it('null si detail no es un string', () => {
    expect(reviewErrorDetail(httpError(400, { detail: ['a', 'b'] }))).toBeNull();
  });

  it('null si no es un HttpErrorResponse', () => {
    expect(reviewErrorDetail(new Error('otra cosa'))).toBeNull();
  });
});
