import { HttpErrorResponse } from '@angular/common/http';
import { classifyAuthError } from './auth-errors';

describe('classifyAuthError', () => {
  const http = (status: number) => new HttpErrorResponse({ status });

  it('clasifica el 429 como rate-limited', () => {
    expect(classifyAuthError(http(429))).toBe('rate-limited');
  });

  it('mantiene las demas categorias', () => {
    expect(classifyAuthError(http(0))).toBe('network');
    expect(classifyAuthError(http(401))).toBe('credentials');
    expect(classifyAuthError(http(500))).toBe('server');
    expect(classifyAuthError(http(400))).toBe('request');
    expect(classifyAuthError(http(422))).toBe('request');
    expect(classifyAuthError(new Error('x'))).toBe('unknown');
  });
});
