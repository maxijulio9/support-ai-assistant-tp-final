import { Injectable, computed, signal } from '@angular/core';
import { getTokenExpiry } from './jwt.util';

const STORAGE_KEY = 'soporte-n1.session';

// Roles conocidos por el backend (ver backend/app/modules/auth/schemas.py, Literal["admin", "agent"]).
export const ROLE_ADMIN = 'admin';
export const ROLE_AGENT = 'agent';

interface StoredSession {
  token: string;
  role: string;
}

function isValidStoredSession(value: unknown): value is StoredSession {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate['token'] === 'string' && candidate['token'].length > 0 &&
    typeof candidate['role'] === 'string' && candidate['role'].length > 0
  );
}

@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly tokenSignal = signal<string | null>(null);
  private readonly roleSignal = signal<string | null>(null);

  readonly token = this.tokenSignal.asReadonly();
  readonly role = this.roleSignal.asReadonly();
  readonly isAuthenticated = computed(() => this.tokenSignal() !== null);

  constructor() {
    this.restoreFromStorage();
  }

  // Rechaza token o rol vacios sin tocar signals ni storage. Devuelve true
  // cuando la sesion quedo guardada en memoria, aunque el storage falle.
  setSession(token: string, role: string): boolean {
    if (!token || !role) return false;
    this.tokenSignal.set(token);
    this.roleSignal.set(role);
    this.writeToStorage(token, role);
    return true;
  }

  clear(): void {
    this.tokenSignal.set(null);
    this.roleSignal.set(null);
    this.removeFromStorage();
  }

  // Decodifica el token solo para uso de interfaz (ver jwt.util.ts). No valida
  // la firma: el backend es la unica autoridad sobre si un token sigue siendo valido.
  // Sin token en memoria devuelve true. Los guards no deben usar este metodo solo:
  // tienen que chequear isAuthenticated() y el vencimiento por separado, porque un
  // token ausente y un token vencido son casos distintos para decidir a donde redirigir.
  isTokenExpired(): boolean {
    const token = this.tokenSignal();
    if (!token) return true;
    const expiry = getTokenExpiry(token);
    if (expiry === undefined) return true; // token mal formado
    if (expiry === null) return false; // sin claim exp valido, decide el servidor
    return expiry * 1000 <= Date.now();
  }

  // El rol guardado es solo para mostrar u ocultar elementos de la interfaz.
  // La autorizacion real siempre la hace el backend en cada request.
  hasRole(role: string): boolean {
    return this.roleSignal() === role;
  }

  private restoreFromStorage(): void {
    const stored = this.readFromStorage();
    if (!stored) return;
    this.tokenSignal.set(stored.token);
    this.roleSignal.set(stored.role);
    if (this.isTokenExpired()) {
      this.clear();
    }
  }

  private readFromStorage(): StoredSession | null {
    let raw: string | null;
    try {
      raw = sessionStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
    if (!raw) return null;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      this.removeFromStorage();
      return null;
    }
    if (!isValidStoredSession(parsed)) {
      this.removeFromStorage();
      return null;
    }
    return parsed;
  }

  private writeToStorage(token: string, role: string): void {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ token, role }));
    } catch {
      // si el storage no esta disponible, la sesion sigue funcionando en memoria
    }
  }

  private removeFromStorage(): void {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // nada que hacer si el storage no esta disponible
    }
  }
}
