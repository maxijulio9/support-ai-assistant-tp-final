// "ayer, HH:mm" para cualquier diferencia de 24h o mas es una
// simplificacion deliberada pedida en el diseño, no distingue 1 dia de
// varios.
export function formatRelativeTime(createdAt: string | null | undefined): string {
  if (!createdAt) return '';
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return '';

  const diffMs = Date.now() - date.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours >= 24) {
    const time = date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
    return `ayer, ${time}`;
  }

  const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
  const diffMinutes = Math.round(diffMs / (1000 * 60));
  if (diffMinutes < 60) {
    return rtf.format(-diffMinutes, 'minute');
  }
  return rtf.format(-Math.round(diffHours), 'hour');
}
