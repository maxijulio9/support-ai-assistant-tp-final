"""Tests unitarios para ProjectWorkflowMap.
No requiere mocks, es logica pura sobre datos de workflow ya traidos de Jira."""

from app.modules.internal_api.project_workflow_map import ProjectWorkflowMap


# arma un workflow de ejemplo con 4 estados: A, B, C (global, alcanzable desde cualquier lado), D (aislado, sin entrada)
def _build_simple_workflow():
    workflow = {
        "transitions": [
            {"id": "t1", "type": "DIRECTED", "toStatusReference": "B", "links": [{"fromStatusReference": "A"}]},
            {"id": "t2", "type": "DIRECTED", "toStatusReference": "A", "links": [{"fromStatusReference": "B"}]},
            {"id": "t3", "type": "GLOBAL", "toStatusReference": "C"},
            {"id": "t0", "type": "INITIAL", "toStatusReference": "A"},
        ],
    }
    status_names = {"A": "Estado A", "B": "Estado B", "C": "Estado C", "D": "Estado D"}
    return workflow, status_names


# arma un workflow sin ninguna transicion global, solo una cadena directa A -> B -> C, para probar multi salto limpio
def _build_chain_workflow():
    workflow = {
        "transitions": [
            {"id": "t1", "type": "DIRECTED", "toStatusReference": "B", "links": [{"fromStatusReference": "A"}]},
            {"id": "t2", "type": "DIRECTED", "toStatusReference": "C", "links": [{"fromStatusReference": "B"}]},
        ],
    }
    status_names = {"A": "Estado A", "B": "Estado B", "C": "Estado C"}
    return workflow, status_names


# verifica que encuentra un camino directo de un salto
def test_find_path_direct():
    workflow, status_names = _build_simple_workflow()
    workflow_map = ProjectWorkflowMap(workflow, status_names)

    path = workflow_map.find_path("Estado A", "Estado B")

    assert path == ["t1"]


# verifica que una transicion GLOBAL esta disponible desde cualquier estado, incluso uno sin transiciones directas propias
def test_find_path_via_global_transition():
    workflow, status_names = _build_simple_workflow()
    workflow_map = ProjectWorkflowMap(workflow, status_names)

    path = workflow_map.find_path("Estado B", "Estado C")

    assert path == ["t3"]


# verifica que encuentra el camino mas corto cuando hace falta mas de un salto, sin ningun atajo global de por medio
def test_find_path_multi_hop():
    workflow, status_names = _build_chain_workflow()
    workflow_map = ProjectWorkflowMap(workflow, status_names)

    path = workflow_map.find_path("Estado A", "Estado C")

    assert path == ["t1", "t2"]


# verifica que devuelve None si no existe ningun camino, ni directo ni multi salto
def test_find_path_returns_none_when_unreachable():
    workflow, status_names = _build_simple_workflow()
    workflow_map = ProjectWorkflowMap(workflow, status_names)

    path = workflow_map.find_path("Estado A", "Estado D")

    assert path is None


# verifica que devuelve lista vacia si origen y destino son el mismo estado
def test_find_path_same_status_returns_empty_list():
    workflow, status_names = _build_simple_workflow()
    workflow_map = ProjectWorkflowMap(workflow, status_names)

    path = workflow_map.find_path("Estado A", "Estado A")

    assert path == []


# verifica que devuelve None si alguno de los nombres de estado no existe en el workflow
def test_find_path_returns_none_for_unknown_status_name():
    workflow, status_names = _build_simple_workflow()
    workflow_map = ProjectWorkflowMap(workflow, status_names)

    path = workflow_map.find_path("Estado Inexistente", "Estado A")

    assert path is None


# verifica que INITIAL se ignora, no genera una arista usable entre estados vivos
def test_find_path_ignores_initial_transition():
    workflow, status_names = _build_simple_workflow()
    workflow_map = ProjectWorkflowMap(workflow, status_names)

    path = workflow_map.find_path("Estado D", "Estado A")

    assert path is None