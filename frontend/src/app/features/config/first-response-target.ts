export const MIN_FIRST_RESPONSE_TARGET_SECONDS = 1;

export type FirstResponseTargetError = 'required' | 'integer' | 'min';

// El backend responde 422 con menos de 1 segundo, y el contrato espera un
// entero: se valida aca para no llegar a ese error.
export function firstResponseTargetError(value: number | null): FirstResponseTargetError | null {
  if (value === null || value === undefined || Number.isNaN(value)) return 'required';
  if (!Number.isInteger(value)) return 'integer';
  if (value < MIN_FIRST_RESPONSE_TARGET_SECONDS) return 'min';
  return null;
}

export function formatFirstResponseTarget(seconds: number): string {
  return `${seconds} s`;
}
