// Etiquetas legibles para resolution_channel. No se usa en ningun lado
// todavia (by_resolution_channel no se renderiza hoy en el frontend), pero
// la funcion ya tolera los dos canales nuevos de CU24/CU25 para cuando se
// conecte. Un valor desconocido se muestra crudo, sin romper nada.
const RESOLUTION_CHANNEL_LABELS: Record<string, string> = {
  AUTO: 'Automática',
  REVIEWED_APPROVED: 'Aprobada por una persona',
  REVIEWED_REGENERATED: 'Regenerada y aprobada',
  REVIEWED_EDITED: 'Aprobada con edición',
  ESCALATED_BY_HUMAN: 'Escalada por una persona',
  RESOLVED_EXTERNALLY: 'Resuelta externamente',
  DISCARDED_BY_HUMAN: 'Descartada por una persona',
};

// null: todavia no se resolvio o no se puede determinar (mismo significado
// que documenta ResolutionChannelCount en el contrato).
export function resolutionChannelLabel(value: string | null): string {
  if (value === null) return 'Sin resolver';
  return RESOLUTION_CHANNEL_LABELS[value] ?? value;
}
