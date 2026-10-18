"""Tests unitarios para el listado de los tipos de solicitud incorporados a un proyecto.
Se mockean la base de datos y los servicios, sin tocar nada real."""

import pytest
from unittest.mock import patch, MagicMock
from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.modules.auth.dependencies import require_admin
from app.modules.internal_api.router import router
from app.modules.internal_api.repositories.request_type_configuration_repository import RequestTypeConfigurationRepository
from app.modules.internal_api.services.itsm_project_onboarding_service import ItsmProjectOnboardingService

REPOSITORY_DB = "app.modules.internal_api.repositories.request_type_configuration_repository.get_db"
ROUTER_SERVICE = "app.modules.internal_api.router._project_onboarding_service"

app = FastAPI()
app.include_router(router)
client = TestClient(app)


# arma una fila simulada de la consulta de tipos de solicitud
def _row(id, name, is_active):
    row = MagicMock()
    row.id = id
    row.name = name
    row.is_active = is_active
    return row


# verifica que el repositorio devuelve los tipos de solicitud vinculados, con el id convertido a texto
@patch(REPOSITORY_DB)
def test_list_project_request_types_returns_linked_types(mock_get_db):
    mock_db = MagicMock()
    mock_get_db.return_value = iter([mock_db])
    mock_db.execute.return_value.fetchone.return_value = MagicMock(id="proj-1")
    mock_db.execute.return_value.fetchall.return_value = [
        _row("rt-1", "Consulta general", True),
        _row("rt-2", "Incidente", False),
    ]

    result = RequestTypeConfigurationRepository().list_project_request_types("TARG")

    assert result == [
        {"id": "rt-1", "name": "Consulta general", "is_active": True},
        {"id": "rt-2", "name": "Incidente", "is_active": False},
    ]
    assert mock_db.execute.call_args_list[1][0][1] == {"project_id": "proj-1"}


# verifica que un project_key que no existe lanza ValueError, sin hacer la segunda consulta
@patch(REPOSITORY_DB)
def test_list_project_request_types_rejects_unknown_project(mock_get_db):
    mock_db = MagicMock()
    mock_get_db.return_value = iter([mock_db])
    mock_db.execute.return_value.fetchone.return_value = None

    with pytest.raises(ValueError, match="no existe"):
        RequestTypeConfigurationRepository().list_project_request_types("NOEXISTE")

    assert mock_db.execute.call_count == 1


# verifica que el servicio delega en el repositorio, sin consultar JSM
def test_service_delegates_to_repository():
    service = ItsmProjectOnboardingService.__new__(ItsmProjectOnboardingService)
    service.request_type_configuration_repository = MagicMock()
    service.request_type_configuration_repository.list_project_request_types.return_value = [
        {"id": "rt-1", "name": "Consulta general", "is_active": True}
    ]

    result = service.list_project_request_types("TARG")

    assert result == [{"id": "rt-1", "name": "Consulta general", "is_active": True}]
    service.request_type_configuration_repository.list_project_request_types.assert_called_once_with("TARG")


# verifica que el endpoint devuelve 200 con la lista de tipos de solicitud
@patch(ROUTER_SERVICE)
def test_get_project_request_types_success(mock_service):
    mock_service.list_project_request_types.return_value = [{"id": "rt-1", "name": "Consulta general", "is_active": True}]

    app.dependency_overrides[require_admin] = lambda: MagicMock(id="admin-1", role="admin")

    response = client.get("/api/config/itsm/projects/TARG/request-types")

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == {"request_types": [{"id": "rt-1", "name": "Consulta general", "is_active": True}]}
    mock_service.list_project_request_types.assert_called_once_with("TARG")


# verifica que un project_key inexistente se traduce en HTTP 400 con el mensaje del servicio
@patch(ROUTER_SERVICE)
def test_get_project_request_types_unknown_project_returns_400(mock_service):
    mock_service.list_project_request_types.side_effect = ValueError("project_key 'NOEXISTE' no existe")

    app.dependency_overrides[require_admin] = lambda: MagicMock(id="admin-1", role="admin")

    response = client.get("/api/config/itsm/projects/NOEXISTE/request-types")

    app.dependency_overrides.clear()

    assert response.status_code == 400
    assert "no existe" in response.json()["detail"]


# verifica que un error inesperado se traduce en HTTP 503
@patch(ROUTER_SERVICE)
def test_get_project_request_types_unexpected_error_returns_503(mock_service):
    mock_service.list_project_request_types.side_effect = Exception("falla de bd")

    app.dependency_overrides[require_admin] = lambda: MagicMock(id="admin-1", role="admin")

    response = client.get("/api/config/itsm/projects/TARG/request-types")

    app.dependency_overrides.clear()

    assert response.status_code == 503
