"""Tests unitarios para la lectura de la configuracion guardada de los proyectos.
Se mockean la base de datos y los servicios, sin tocar nada real."""

import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.modules.auth.dependencies import require_admin
from app.modules.internal_api.router import router
from app.modules.internal_api.repositories.project_configuration_reader_repository import ProjectConfigurationReaderRepository
from app.modules.internal_api.services.project_configuration_reader_service import ProjectConfigurationReaderService

REPOSITORY_DB = "app.modules.internal_api.repositories.project_configuration_reader_repository.get_db"
ROUTER_READER = "app.modules.internal_api.router._project_configuration_reader_service"
ROUTER_ONBOARDING = "app.modules.internal_api.router._project_onboarding_service"

app = FastAPI()
app.include_router(router)
client = TestClient(app)


# arma una fila simulada con los atributos indicados
def _row(**attributes):
    row = MagicMock()
    for key, value in attributes.items():
        setattr(row, key, value)
    return row


# arma el resultado simulado de una consulta
def _result(rows=None, one=None):
    result = MagicMock()
    result.fetchall.return_value = rows or []
    result.fetchone.return_value = one
    return result


# arma una fila simulada de la tabla project, con los umbrales de ejemplo
def _project_row(**overrides):
    defaults = {
        "id": "proj-1", "code": "TARG", "name": "Argentina", "country_code": "AR", "language_code": "es",
        "is_active": True, "threshold_auto_publish": 0.9, "threshold_needs_review": 0.55, "similarity_threshold": 0.4,
    }
    defaults.update(overrides)
    return _row(**defaults)


# arma la configuracion completa de un proyecto, como la devuelve el servicio
def _configuration():
    return {
        "project": {
            "project_id": "proj-1", "key": "TARG", "name": "Argentina", "country_code": "AR", "language_code": "es",
            "is_active": True, "threshold_auto_publish": 0.9, "threshold_needs_review": 0.55, "similarity_threshold": 0.4, "first_response_target_seconds": 30, "multi_step_transitions_enabled": False,
        },
        "categories": [{"id": "cat-1", "name": "Acceso", "is_active": True}],
        "request_types": [{"id": "rt-1", "name": "Portal Tokenia", "is_active": True}],
        "priority_mapping": {"Highest": ["1"], "Low": ["4", "5"]},
        "status_mappings": [{"status_id": "st-1", "status_name": "Open", "system_action": None, "is_active": True}],
        "spaces": [{"space_key": "TA", "description": None, "language_code": "es", "country_code": "AR", "is_active": True}],
    }


# verifica que la lista de proyectos devuelve el id como texto y completa con el valor por defecto un umbral vacio
@patch(REPOSITORY_DB)
def test_list_projects_returns_projects_with_effective_thresholds(mock_get_db):
    mock_db = MagicMock()
    mock_get_db.return_value = iter([mock_db])
    mock_db.execute.return_value.fetchall.return_value = [
        _project_row(),
        _project_row(id="proj-2", code="TBRA", name="Brasil", country_code=None, language_code=None,
                     threshold_auto_publish=None, threshold_needs_review=None, similarity_threshold=None),
    ]

    result = ProjectConfigurationReaderRepository().list_projects()

    assert result[0]["project_id"] == "proj-1"
    assert result[0]["key"] == "TARG"
    assert result[0]["threshold_auto_publish"] == 0.9
    assert result[1]["threshold_auto_publish"] == 0.85
    assert result[1]["threshold_needs_review"] == 0.60
    assert result[1]["similarity_threshold"] == 0.40
    assert result[1]["country_code"] is None


# verifica que la configuracion de un proyecto junta todas sus secciones, con el mapeo de prioridades agrupado por nivel
@patch(REPOSITORY_DB)
def test_get_project_configuration_assembles_every_section(mock_get_db):
    mock_db = MagicMock()
    mock_get_db.return_value = iter([mock_db])
    mock_db.execute.side_effect = [
        _result(one=_project_row()),
        _result(rows=[_row(id="cat-1", name="Acceso", is_active=True)]),
        _result(rows=[_row(id="rt-1", name="Portal Tokenia", is_active=True)]),
        _result(rows=[_row(code="Highest", system_priority_id="1"), _row(code="Low", system_priority_id="4"), _row(code="Low", system_priority_id="5")]),
        _result(rows=[_row(status_id="st-1", status_name="Open", system_action="21", is_active=True)]),
        _result(rows=[_row(space_key="TA", description=None, language_code="es", country_code="AR", is_active=True)]),
    ]

    result = ProjectConfigurationReaderRepository().get_project_configuration("TARG")

    assert result["project"]["key"] == "TARG"
    assert result["categories"] == [{"id": "cat-1", "name": "Acceso", "is_active": True}]
    assert result["request_types"] == [{"id": "rt-1", "name": "Portal Tokenia", "is_active": True}]
    assert result["priority_mapping"] == {"Highest": ["1"], "Low": ["4", "5"]}
    assert result["status_mappings"] == [{"status_id": "st-1", "status_name": "Open", "system_action": "21", "is_active": True}]
    assert result["spaces"][0]["space_key"] == "TA"
    assert mock_db.execute.call_args_list[1][0][1] == {"project_id": "proj-1"}


# verifica que un project_key inexistente lanza ValueError, sin hacer las demas consultas
@patch(REPOSITORY_DB)
def test_get_project_configuration_rejects_unknown_project(mock_get_db):
    mock_db = MagicMock()
    mock_get_db.return_value = iter([mock_db])
    mock_db.execute.return_value.fetchone.return_value = None

    with pytest.raises(ValueError, match="no existe"):
        ProjectConfigurationReaderRepository().get_project_configuration("NOEXISTE")

    assert mock_db.execute.call_count == 1


# verifica que el servicio delega en el repositorio
def test_service_delegates_to_repository():
    service = ProjectConfigurationReaderService.__new__(ProjectConfigurationReaderService)
    service.reader_repository = MagicMock()
    service.reader_repository.list_projects.return_value = [{"project_id": "proj-1"}]
    service.reader_repository.get_project_configuration.return_value = {"project": {}}

    assert service.list_projects() == [{"project_id": "proj-1"}]
    assert service.get_project_configuration("TARG") == {"project": {}}
    service.reader_repository.get_project_configuration.assert_called_once_with("TARG")


# verifica que el endpoint de la lista devuelve 200 con los proyectos
@patch(ROUTER_READER)
def test_list_onboarded_projects_success(mock_reader):
    mock_reader.list_projects.return_value = [_configuration()["project"]]

    app.dependency_overrides[require_admin] = lambda: MagicMock(id="admin-1", role="admin")

    response = client.get("/api/config/itsm/projects")

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["projects"][0]["project_id"] == "proj-1"
    assert response.json()["projects"][0]["key"] == "TARG"


# verifica que un error inesperado al listar se traduce en HTTP 503
@patch(ROUTER_READER)
def test_list_onboarded_projects_unexpected_error_returns_503(mock_reader):
    mock_reader.list_projects.side_effect = Exception("falla de bd")

    app.dependency_overrides[require_admin] = lambda: MagicMock(id="admin-1", role="admin")

    response = client.get("/api/config/itsm/projects")

    app.dependency_overrides.clear()

    assert response.status_code == 503


# verifica que el endpoint de detalle devuelve 200 con todas las secciones
@patch(ROUTER_READER)
def test_get_project_configuration_success(mock_reader):
    mock_reader.get_project_configuration.return_value = _configuration()

    app.dependency_overrides[require_admin] = lambda: MagicMock(id="admin-1", role="admin")

    response = client.get("/api/config/itsm/projects/TARG")

    app.dependency_overrides.clear()

    body = response.json()
    assert response.status_code == 200
    assert body["project"]["key"] == "TARG"
    assert body["priority_mapping"] == {"Highest": ["1"], "Low": ["4", "5"]}
    assert body["status_mappings"][0]["status_name"] == "Open"
    mock_reader.get_project_configuration.assert_called_once_with("TARG")


# verifica que un project_key inexistente se traduce en HTTP 400 con el mensaje del servicio
@patch(ROUTER_READER)
def test_get_project_configuration_unknown_project_returns_400(mock_reader):
    mock_reader.get_project_configuration.side_effect = ValueError("project_key 'NOEXISTE' no existe")

    app.dependency_overrides[require_admin] = lambda: MagicMock(id="admin-1", role="admin")

    response = client.get("/api/config/itsm/projects/NOEXISTE")

    app.dependency_overrides.clear()

    assert response.status_code == 400
    assert "no existe" in response.json()["detail"]


# verifica que la ruta de proyectos disponibles en JSM no queda tapada por la del detalle de un proyecto
@patch(ROUTER_ONBOARDING)
@patch(ROUTER_READER)
def test_available_projects_route_is_not_shadowed_by_project_detail(mock_reader, mock_onboarding):
    mock_onboarding.list_available_projects = AsyncMock(return_value=[{"key": "TARG", "name": "Argentina"}])

    app.dependency_overrides[require_admin] = lambda: MagicMock(id="admin-1", role="admin")

    response = client.get("/api/config/itsm/projects/available")

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == {"projects": [{"key": "TARG", "name": "Argentina"}]}
    mock_reader.get_project_configuration.assert_not_called()
