import { ItsmConnectionRequest } from '../../api/models/itsm-connection-request';
import { JsmConnectionStatusResponse } from '../../api/models/jsm-connection-status-response';

export interface JsmConnectionFormValues {
  baseUrl: string;
  userEmail: string;
  apiToken: string;
}

// El secreto de los webhooks no va en el cuerpo: si se omite, el backend
// conserva el que ya hay y, si no hay ninguno, genera uno. Mandar la clave,
// aunque sea con null, no es lo mismo que omitirla.
export function buildJsmConnectionRequest(values: JsmConnectionFormValues): ItsmConnectionRequest {
  return { base_url: values.baseUrl, user_email: values.userEmail, api_token: values.apiToken };
}

// Estado que se muestra de inmediato despues de guardar, hasta que llega el
// que devuelve el backend. Despues de un guardado exitoso siempre hay un
// secreto: el que ya estaba o el que genera el sistema.
export function statusAfterSave(baseUrl: string, userEmail: string): JsmConnectionStatusResponse {
  return { base_url: baseUrl, configured: true, user_email: userEmail, webhook_secret_configured: true };
}
