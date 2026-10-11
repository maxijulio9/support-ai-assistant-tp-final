// Solo se acepta https: cualquier otro esquema (http:, javascript:, data:,
// etc.) o un valor que no sea una URL valida devuelve null, y la key se
// muestra como texto plano.
export function safeTicketUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' ? parsed.href : null;
  } catch {
    return null;
  }
}
