import { ItsmConnectionRequest } from '../../api/models/itsm-connection-request';
import { JsmConnectionStatusResponse } from '../../api/models/jsm-connection-status-response';

export interface JsmConnectionFormValues {
  baseUrl: string;
  userEmail: string;
  apiToken: string;
}

// Lo ultimo que el backend tiene guardado de la conexion
export interface SavedJsmConnection {
  configured: boolean;
  baseUrl: string | null;
  userEmail: string | null;
}

export const NO_SAVED_CONNECTION: SavedJsmConnection = { configured: false, baseUrl: null, userEmail: null };

// 'no-connection': todavia no hay conexion guardada, el token es obligatorio.
// 'changed': cambio la URL o el correo respecto de lo guardado, el token
// vuelve a ser obligatorio. 'optional': sin cambios, el token guardado se
// conserva si no se manda uno.
export type ApiTokenRequirement = 'no-connection' | 'changed' | 'optional';

// Para comparar, la URL y el correo se normalizan igual que el backend:
// recortar espacios, pasar a minusculas y, en la URL, sacar las barras
// finales. Solo sirve para decidir si el token es obligatorio: lo que se
// manda no se normaliza (ver buildJsmConnectionRequest).
export function normalizeBaseUrl(url: string): string {
  return url.trim().toLowerCase().replace(/\/+$/, '');
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function apiTokenRequirement(
  saved: SavedJsmConnection,
  current: Pick<JsmConnectionFormValues, 'baseUrl' | 'userEmail'>,
): ApiTokenRequirement {
  if (!saved.configured || !saved.baseUrl?.trim() || !saved.userEmail?.trim()) return 'no-connection';

  const sameUrl = normalizeBaseUrl(current.baseUrl) === normalizeBaseUrl(saved.baseUrl);
  const sameEmail = normalizeEmail(current.userEmail) === normalizeEmail(saved.userEmail);
  return sameUrl && sameEmail ? 'optional' : 'changed';
}

// Un token con solo espacios cuenta como ausente.
export function hasApiToken(apiToken: string): boolean {
  return apiToken.trim().length > 0;
}

export const API_TOKEN_HINTS: Record<ApiTokenRequirement, string> = {
  optional: 'Guardado. Dejalo vacío para conservarlo o ingresá uno nuevo para reemplazarlo.',
  changed: 'Cambiaste la URL o el correo, así que hay que ingresar el API token de nuevo.',
  'no-connection': 'Generalo desde tu cuenta de Atlassian.',
};

// Cuerpo del POST: la URL, el correo y el token recortados, pero sin cambiar
// mayusculas ni quitar barras, porque el backend guarda lo que recibe y lo
// devuelve tal cual. El token se omite si esta vacio o con solo espacios, que
// es lo que hace que el backend use el guardado (mandar la clave, aunque sea
// con null o en blanco, no es lo mismo que omitirla). El secreto de los
// webhooks no va nunca: si se omite, el backend conserva el que ya hay y, si
// no hay ninguno, genera uno.
export function buildJsmConnectionRequest(values: JsmConnectionFormValues): ItsmConnectionRequest {
  const request: ItsmConnectionRequest = { base_url: values.baseUrl.trim(), user_email: values.userEmail.trim() };
  if (hasApiToken(values.apiToken)) request.api_token = values.apiToken.trim();
  return request;
}

// Estado que se muestra de inmediato despues de guardar, hasta que llega el
// que devuelve el backend. Despues de un guardado exitoso siempre hay un
// secreto: el que ya estaba o el que genera el sistema.
export function statusAfterSave(baseUrl: string, userEmail: string): JsmConnectionStatusResponse {
  return { base_url: baseUrl, configured: true, user_email: userEmail, webhook_secret_configured: true };
}
