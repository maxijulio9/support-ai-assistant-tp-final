import { CanActivateFn } from '@angular/router';

export function roleGuard(_requiredRole: string): CanActivateFn {
  return () => true;
}
