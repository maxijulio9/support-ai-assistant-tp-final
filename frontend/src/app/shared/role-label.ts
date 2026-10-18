// Traduccion del rol para mostrar en la interfaz. Un rol desconocido se
// muestra tal cual (no rompe, no inventa una traduccion).
const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  agent: 'Agente',
};

export function roleLabel(role: string | undefined): string {
  if (!role) return '';
  return ROLE_LABELS[role] ?? role;
}
