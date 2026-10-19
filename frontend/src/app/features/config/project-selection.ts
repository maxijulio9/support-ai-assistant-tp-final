// Si la key pedida (por ejemplo desde ?project=) no esta entre las
// disponibles, o no se pidio ninguna, se cae en la primera. Sin proyectos
// no hay nada para elegir.
export function resolveSelectedProjectKey(projectKeys: string[], requestedKey: string | null): string | null {
  if (projectKeys.length === 0) return null;
  if (requestedKey && projectKeys.includes(requestedKey)) return requestedKey;
  return projectKeys[0];
}
