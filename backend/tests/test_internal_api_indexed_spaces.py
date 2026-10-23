"""Tests unitarios para el estado de indexacion por space.
Se mockean la base de datos y el repositorio, sin tocar nada real."""

from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import patch, MagicMock
from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest
from app.main import app as main_app
from app.modules.auth.dependencies import require_admin
from app.modules.internal_api.router import router
from app.modules.internal_api.repositories.kb_space_status_repository import KbSpaceStatusRepository
from app.modules.event_pipeline.indexing_status_repository import (
    STALE_AFTER_MINUTES,
    STALE_QUEUED_DETAIL,
    STALE_RUNNING_DETAIL,
)

REPO_DB = "app.modules.internal_api.repositories.kb_space_status_repository.get_db"
ROUTER_REPO = "app.modules.internal_api.router._kb_space_status_repository"
MOMENT = datetime(2026, 10, 23, 0, 45, tzinfo=timezone.utc)

app = FastAPI()
app.include_router(router)
client = TestClient(app)


# arma la fila de un space con sus conteos, con los valores de TA por defecto
def _space_row(**overrides):
    values = {
        "space_key": "TA", "description": "Soporte", "country_code": "AR", "language_code": "es",
        "documents": 7, "chunks": 21, "last_updated_at": MOMENT,
    }
    values.update(overrides)
    return SimpleNamespace(**values)


# arma la fila de la corrida mas reciente de un space
def _run_row(**overrides):
    values = {
        "space_key": "TA", "id": "run-1", "status": "completed", "error_detail": None,
        "started_at": MOMENT, "updated_at": MOMENT, "is_stale": False,
    }
    values.update(overrides)
    return SimpleNamespace(**values)


# lista los spaces con una base simulada que reconoce cada consulta por su texto, devuelve el resultado y lo ejecutado
def _list(spaces, runs, project_key=None, project_exists=True):
    executed = []

    def execute(sql, params=None):
        statement = " ".join(str(sql).split())
        executed.append((statement, params))
        result = MagicMock()
        if "FROM project WHERE code" in statement:
            result.fetchone.return_value = SimpleNamespace(id="proj-1") if project_exists else None
        elif "FROM kb_spaces ks" in statement:
            result.fetchall.return_value = spaces
        elif "FROM kb_indexing_status" in statement:
            result.fetchall.return_value = runs
        return result

    db = MagicMock()
    db.execute.side_effect = execute
    with patch(REPO_DB) as mock_get_db:
        mock_get_db.return_value = iter([db])
        result = KbSpaceStatusRepository().list_spaces(project_key)
    return result, executed


# hace que el endpoint vea a un admin autenticado
def _as_admin():
    app.dependency_overrides[require_admin] = lambda: MagicMock(id="admin-1", role="admin")


# verfica que cada space trae sus paginas, sus fragmentos y la fecha de su ultima escritura
def test_returns_each_space_with_its_counts_and_dates():
    result, _ = _list([_space_row()], [_run_row()])

    assert result[0]["space_key"] == "TA"
    assert result[0]["documents"] == 7
    assert result[0]["chunks"] == 21
    assert result[0]["country_code"] == "AR"
    assert result[0]["last_updated_at"] == MOMENT.isoformat()


# verifica que un space que nunca se indexo trae ceros, sin fecha y sin corrida
def test_a_space_that_was_never_indexed_has_zero_counts_and_no_dates():
    never = _space_row(space_key="TX", documents=0, chunks=0, last_updated_at=None)

    result, _ = _list([never], [_run_row()])

    assert result[0]["documents"] == 0
    assert result[0]["chunks"] == 0
    assert result[0]["last_updated_at"] is None
    assert result[0]["last_run"] is None


# verifica que cada space trae su propia ultima corrida y los que no tienen ninguna quedan en null
def test_attaches_the_latest_run_of_each_space():
    spaces = [_space_row(space_key="TA"), _space_row(space_key="TB", country_code="BR"), _space_row(space_key="TG", country_code=None)]
    runs = [_run_row(space_key="TA", id="run-a"), _run_row(space_key="TB", id="run-b", status="running")]

    result, _ = _list(spaces, runs)

    assert result[0]["last_run"]["id"] == "run-a"
    assert result[1]["last_run"]["id"] == "run-b"
    assert result[1]["last_run"]["status"] == "running"
    assert result[2]["last_run"] is None
    assert result[2]["country_code"] is None


# verifica que una corrida en running sin actualizaciones se informa como fallida con su explicacion
def test_a_stale_running_run_is_reported_as_failed():
    result, _ = _list([_space_row()], [_run_row(status="running", is_stale=True)])

    assert result[0]["last_run"]["status"] == "failed"
    assert result[0]["last_run"]["error_detail"] == STALE_RUNNING_DETAIL


# verifica que una corrida en queued sin actualizaciones se informa como fallida con su propia explicacion
def test_a_stale_queued_run_is_reported_as_failed_with_its_own_detail():
    result, _ = _list([_space_row()], [_run_row(status="queued", is_stale=True)])

    assert result[0]["last_run"]["status"] == "failed"
    assert result[0]["last_run"]["error_detail"] == STALE_QUEUED_DETAIL


# verifica que una corrida fallida conserva su propio error
def test_a_failed_run_keeps_its_own_error():
    result, _ = _list([_space_row()], [_run_row(status="failed", error_detail="falla de embeddings")])

    assert result[0]["last_run"]["status"] == "failed"
    assert result[0]["last_run"]["error_detail"] == "falla de embeddings"


# verifica que con project_key la consulta se limita a los spaces del proyecto
def test_filters_by_project_key():
    _, executed = _list([_space_row()], [], project_key="TARG")

    spaces_query, spaces_params = [item for item in executed if "FROM kb_spaces ks" in item[0]][0]
    assert "project_space" in spaces_query
    assert spaces_params == {"project_id": "proj-1"}


# verifica que sin project_key la consulta no filtra por proyecto
def test_without_a_project_the_query_has_no_project_filter():
    _, executed = _list([_space_row()], [])

    spaces_query, spaces_params = [item for item in executed if "FROM kb_spaces ks" in item[0]][0]
    assert "project_space" not in spaces_query
    assert spaces_params == {}
    runs_params = [item for item in executed if "FROM kb_indexing_status" in item[0]][0][1]
    assert runs_params == {"stale_minutes": STALE_AFTER_MINUTES}


# verifica que un proyecto inexistente se rechaza antes de consultar los spaces
def test_unknown_project_is_rejected_before_any_other_query():
    db = MagicMock()
    db.execute.return_value.fetchone.return_value = None

    with patch(REPO_DB) as mock_get_db:
        mock_get_db.return_value = iter([db])
        with pytest.raises(ValueError, match="no existe"):
            KbSpaceStatusRepository().list_spaces("NOEXISTE")

    assert db.execute.call_count == 1


# verifica que el endpoint devuelve los spaces con la forma esperada
@patch(ROUTER_REPO)
def test_endpoint_returns_the_spaces(mock_repo):
    mock_repo.list_spaces.return_value = [{
        "space_key": "TA", "description": "Soporte", "country_code": "AR", "language_code": "es",
        "documents": 7, "chunks": 21, "last_updated_at": MOMENT.isoformat(),
        "last_run": {"id": "run-1", "status": "completed", "started_at": MOMENT.isoformat(),
                     "updated_at": MOMENT.isoformat(), "error_detail": None},
    }]
    _as_admin()

    response = client.get("/api/indexing/spaces")

    app.dependency_overrides.clear()

    assert response.status_code == 200
    body = response.json()["spaces"][0]
    assert body["space_key"] == "TA"
    assert body["documents"] == 7
    assert body["last_run"]["status"] == "completed"
    mock_repo.list_spaces.assert_called_once_with(None)


# verifica que el endpoint le pasa el project_key al repositorio
@patch(ROUTER_REPO)
def test_endpoint_passes_the_project_key_to_the_repository(mock_repo):
    mock_repo.list_spaces.return_value = []
    _as_admin()

    response = client.get("/api/indexing/spaces", params={"project_key": "TBRA"})

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == {"spaces": []}
    mock_repo.list_spaces.assert_called_once_with("TBRA")


# verifica que un proyecto inexistente se traduce en HTTP 400 con el mensaje en texto legible
@patch(ROUTER_REPO)
def test_endpoint_unknown_project_returns_400(mock_repo):
    mock_repo.list_spaces.side_effect = ValueError("project_key 'NOEXISTE' no existe")
    _as_admin()

    response = client.get("/api/indexing/spaces", params={"project_key": "NOEXISTE"})

    app.dependency_overrides.clear()

    assert response.status_code == 400
    assert response.json()["detail"] == "project_key 'NOEXISTE' no existe"


# verifica que un error inesperado se traduce en HTTP 503
@patch(ROUTER_REPO)
def test_endpoint_unexpected_error_returns_503(mock_repo):
    mock_repo.list_spaces.side_effect = Exception("falla de bd")
    _as_admin()

    response = client.get("/api/indexing/spaces")

    app.dependency_overrides.clear()

    assert response.status_code == 503


# verifica en el contrato que la ruta declara el 400 y que los campos del space son obligatorios
def test_contract_declares_the_route_its_400_and_the_required_fields():
    spec = main_app.openapi()
    get = spec["paths"]["/api/indexing/spaces"]["get"]
    required = set(spec["components"]["schemas"]["IndexedSpace"]["required"])

    assert "400" in get["responses"]
    assert {"space_key", "description", "country_code", "language_code", "documents", "chunks", "last_updated_at", "last_run"} <= required
