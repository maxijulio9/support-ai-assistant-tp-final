import { SecretValue } from './webhook-secret-state';

// Lo que interesa de la respuesta del secreto. masked es opcional porque el
// contrato lo declara con valor por defecto false.
export interface WebhookSecretBody {
  webhook_secret: string;
  masked?: boolean;
}

// Pasa la respuesta del backend al valor que maneja la pantalla. Un masked
// ausente se trata como false, que es el default del contrato.
export function toSecretValue(body: WebhookSecretBody): SecretValue {
  return { value: body.webhook_secret, masked: body.masked ?? false };
}
