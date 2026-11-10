import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { classifyAuthError } from './auth-errors';

describe('classifyAuthError', () => {
  const http = (status: number, retryAfter?: string) =>
    new HttpErrorResponse({ status, headers: retryAfter === undefined ? undefined : new HttpHeaders({ 'Retry-After': retryAfter }) });

  it('clasifica el 429 como rate-limited y lee Retry-After', () => {
    expect(classifyAuthError(http(429, '900'))).toEqual({ category: 'rate-limited', retryAfterSeconds: 900 });
  });

  it('un 429 sin Retry-After, no numerico, cero o negativo no trae tiempo', () => {
    expect(classifyAuthError(http(429))).toEqual({ category: 'rate-limited', retryAfterSeconds: null });
    expect(classifyAuthError(http(429, 'pronto'))).toEqual({ category: 'rate-limited', retryAfterSeconds: null });
    expect(classifyAuthError(http(429, '0')).retryAfterSeconds).toBeNull();
    expect(classifyAuthError(http(429, '-1')).retryAfterSeconds).toBeNull();
  });

  it('mantiene las demas categorias, sin tiempo de espera', () => {
    expect(classifyAuthError(http(0))).toEqual({ category: 'network', retryAfterSeconds: null });
    expect(classifyAuthError(http(401, '30')).category).toBe('credentials');
    expect(classifyAuthError(http(500)).category).toBe('server');
    expect(classifyAuthError(http(400)).category).toBe('request');
    expect(classifyAuthError(http(422)).category).toBe('request');
    expect(classifyAuthError(new Error('x')).category).toBe('unknown');
    expect(classifyAuthError(http(401, '30')).retryAfterSeconds).toBeNull();
  });
});
