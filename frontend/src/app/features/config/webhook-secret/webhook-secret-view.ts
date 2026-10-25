export type WebhookSecretBlockView = 'connection-not-saved' | 'no-secret' | 'has-secret';

export interface WebhookSecretViewInput {
  // La conexion con JSM ya se guardo alguna vez
  connectionConfigured: boolean;
  // webhook_secret_configured del estado de la conexion
  secretConfigured: boolean;
  // El pedido del secreto respondio 404
  notFound: boolean;
}

// Que muestra el bloque. Sin conexion guardada no hay secreto todavia, porque
// se genera al guardarla. Con la conexion guardada pero sin secreto (la marca
// en false, o un 404) se ofrece generarlo.
export function webhookSecretBlockView(input: WebhookSecretViewInput): WebhookSecretBlockView {
  if (!input.connectionConfigured) return 'connection-not-saved';
  if (!input.secretConfigured || input.notFound) return 'no-secret';
  return 'has-secret';
}
