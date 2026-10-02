# M7 InternalAPI mapea el workflow completo de un proyecto y busca caminos entre estados
# logica pura, sin llamadas a jira, recibe los datos ya traidos por WorkflowDiscoveryService


class ProjectWorkflowMap:

    def __init__(self, workflow: dict, status_names: dict):
        self.workflow = workflow
        self.status_names = status_names
        self.name_to_reference = {name: ref for ref, name in status_names.items()}
        self.adjacency = self._build_adjacency()

    # arma la lista de adyacencia, separando GLOBAL (disponible desde cualquier estado) de DIRECTED (solo desde su origen)
    # INITIAL se ignora, es solo la creacion del ticket, no un movimiento entre estados vivos
    def _build_adjacency(self) -> dict:
        adjacency = {ref: [] for ref in self.status_names}
        global_transitions = []

        for transition in self.workflow["transitions"]:
            transition_type = transition.get("type")
            to_reference = transition.get("toStatusReference")

            if transition_type == "INITIAL":
                continue

            if transition_type == "GLOBAL":
                global_transitions.append((transition["id"], to_reference))
                continue

            if transition_type == "DIRECTED":
                for link in transition.get("links", []):
                    from_reference = link["fromStatusReference"]
                    adjacency[from_reference].append((transition["id"], to_reference))

        # las globales se agregan como salida de todos los estados, incluidas las que ya son origen de una directed
        for status_reference in adjacency:
            for transition_id, to_reference in global_transitions:
                adjacency[status_reference].append((transition_id, to_reference))

        return adjacency

    # busca el camino mas corto entre dos estados por nombre, BFS clasico
    # devuelve la lista ordenada de transition_id a ejecutar, o None si no existe ningun camino
    def find_path(self, from_status_name: str, to_status_name: str) -> list[str] | None:
        from_reference = self.name_to_reference.get(from_status_name)
        to_reference = self.name_to_reference.get(to_status_name)

        if from_reference is None or to_reference is None:
            return None

        if from_reference == to_reference:
            return []

        visited = {from_reference}
        queue = [(from_reference, [])]

        while queue:
            current_reference, path_so_far = queue.pop(0)

            for transition_id, next_reference in self.adjacency.get(current_reference, []):
                if next_reference in visited:
                    continue

                new_path = path_so_far + [transition_id]

                if next_reference == to_reference:
                    return new_path

                visited.add(next_reference)
                queue.append((next_reference, new_path))

        return None