// Funciones puras para leer el payload de un JWT en el cliente.
// Esto NO valida la firma del token: solo se usa para mejorar la experiencia
// de usuario (por ejemplo, anticipar un logout). La unica fuente de verdad
// sobre si un token es valido es el backend.

// Convierte base64url (RFC 4648 seccion 5) a base64 estandar, agrega el
// padding que falte y decodifica los bytes como UTF-8 (atob por si sola
// devuelve un binary string, no texto UTF-8, ver MDN Window.atob).
function decodeBase64Url(segment: string): string {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder('utf-8').decode(bytes);
}

export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [, payloadSegment] = parts;
  if (payloadSegment === undefined) return null;
  try {
    const json = decodeBase64Url(payloadSegment);
    const parsed: unknown = JSON.parse(json);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

// Significado del valor de retorno:
// - undefined: el token no se pudo decodificar (esta mal formado)
// - null: el token se decodifico pero no trae un claim "exp" numerico valido
// - number: el valor de "exp", en segundos desde epoch (NumericDate, RFC 7519 seccion 4.1.4)
export function getTokenExpiry(token: string): number | null | undefined {
  const payload = decodeJwtPayload(token);
  if (payload === null) return undefined;
  const exp = payload['exp'];
  if (typeof exp !== 'number' || !Number.isFinite(exp)) return null;
  return exp;
}
