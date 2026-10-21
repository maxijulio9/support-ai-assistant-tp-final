// Logica pura de las dos acciones nuevas de Revision (descartar y editar
// antes de aprobar). No depende del cliente generado: review.service.ts usa
// esto para armar los bodies una vez que los endpoints existan.

export const MAX_EDITED_RESPONSE_LENGTH = 5000;

export function normalizeResponseText(value: string): string {
  return value.trim();
}

export function isEditedResponseValid(value: string): boolean {
  const normalized = normalizeResponseText(value);
  return normalized.length > 0 && normalized.length <= MAX_EDITED_RESPONSE_LENGTH;
}

// Si el texto editado (recortado) es identico al generado (recortado), se
// trata como una aprobacion comun: no se manda edited_response.
export function resolveEditedResponse(editedText: string, generatedResponse: string | null): string | null {
  const normalized = normalizeResponseText(editedText);
  const original = normalizeResponseText(generatedResponse ?? '');
  return normalized === original ? null : normalized;
}

// Mismo patron que ya usa review.service.ts para reviewed_by: omitir el
// campo en vez de mandarlo vacio o null. No cambia ese comportamiento, solo
// lo extiende con edited_response.
export function buildApproveBody(
  reviewedBy: string | undefined,
  editedResponse: string | null,
): { reviewed_by?: string; edited_response?: string } {
  const body: { reviewed_by?: string; edited_response?: string } = {};
  if (reviewedBy) body.reviewed_by = reviewedBy;
  if (editedResponse !== null) body.edited_response = editedResponse;
  return body;
}

// El revisor sale del token en discard, nunca se manda en el body.
export function buildDiscardBody(rejectionReason: string): { rejection_reason?: string } {
  const trimmed = rejectionReason.trim();
  return trimmed ? { rejection_reason: trimmed } : {};
}
