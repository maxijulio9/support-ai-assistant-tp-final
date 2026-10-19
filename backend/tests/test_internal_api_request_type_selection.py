"""Tests unitarios para la eleccion de los tipos de solicitud que se incorporan a un proyecto.
Se mockean JSM, las credenciales y la base de datos, sin tocar nada real."""

import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.main import app as main_app
from app.modules.auth.dependencies import require_admin
from app.modules.internal_api.router import router
from app.modules.internal_api.services.itsm_project_onboarding_service import ItsmProjectOnboardingService

ROUTER_SERVICE = "app.modules.internal_api.router._project_onboarding_service"
CREDENTIALS = {"base_url": "https://example.atlassian.net", "user_email": "test@example.com", "api_token": "token-de-prueba"}
JSM_TYPES = [{"id": "10", "name": "Consulta"}, {"id": "11", "name": "Incidente"}, {"id": "12", "name": "Pedido"}]

app = FastAPI()
app.include_router(router)
client = TestClient(app)


# arma el servicio con JSM, las credenciales y los repositorios simulados
def _build_service(linked=None, credentials=CREDENTIALS, service_desk_id="sd-1"):
    service = ItsmProjectOnboardingService.__new__(ItsmProjectOnboardingService)
    service.credentials_repository = MagicMock()
    service.credentials_repository.get_credentials.return_value = credentials
    service.jsm_project_client = MagicMock()
    service.jsm_project_client.get_service_desk_id = AsyncMock(return_value=service_desk_id)
    service.jsm_project_client.get_request_types = AsyncMock(return_value=list(JSM_TYPES))
    service.request_type_configuration_repository = MagicMock()
    service.request_type_configuration_repository.configure_request_types.return_value = 0
    service.request_type_configuration_repository.list_project_request_types.return_value = linked or []
    return service


# verifica que sin lista de ids se incorporan todos los tipos de solicitud de JSM
@pytest.mark.asyncio
async def test_configure_without_ids_incorporates_every_jsm_type():
    service = _build_service()

    await service.configure_request_types("TARG")

    service.request_type_configuration_repository.configure_request_types.assert_called_once_with("TARG", JSM_TYPES)


# verifica que con una lista de ids se incorporan solo los elegidos
@pytest.mark.asyncio
async def test_configure_with_ids_incorporates_only_the_chosen_types():
    service = _build_service()

    await service.configure_request_types("TARG", ["11", "12"])

    service.request_type_configuration_repository.configure_request_types.assert_called_once_with("TARG", [JSM_TYPES[1], JSM_TYPES[2]])


# verifica que un id que no existe en el service desk se rechaza y no se guarda nada
@pytest.mark.asyncio
async def test_configure_rejects_unknown_ids_without_saving():
    service = _build_service()

    with pytest.raises(ValueError, match="99"):
        await service.configure_request_types("TARG", ["11", "99"])

    service.request_type_configuration_repository.configure_request_types.assert_not_called()


# verifica que una lista vacia se rechaza antes de consultar JSM
@pytest.mark.asyncio
async def test_configure_rejects_an_empty_list_before_calling_jsm():
    service = _build_service()

    with pytest.raises(ValueError, match="al menos un tipo"):
        await service.configure_request_types("TARG", [])

    service.credentials_repository.get_credentials.assert_not_called()
    service.jsm_project_client.get_service_desk_id.assert_not_called()


# verifica que el listado marca como incorporados solo los vinculados y activos, comparando por nombre
@pytest.mark.asyncio
async def test_list_available_marks_incorporated_by_name_and_active_state():
    service = _build_service(linked=[
        {"id": "u1", "name": "Consulta", "is_active": True},
        {"id": "u2", "name": "Incidente", "is_active": False},
    ])

    result = await service.list_available_request_types("TARG")

    assert result == [
        {"id": "10", "name": "Consulta", "incorporated": True},
        {"id": "11", "name": "Incidente", "incorporated": False},
        {"id": "12", "name": "Pedido", "incorporated": False},
    ]


# verifica que sin conexion configurada con JSM el listado falla con ValueError
@pytest.mark.asyncio
async def test_list_available_requires_the_jsm_connection():
    service = _build_service(credentials=None)

    with pytest.raises(ValueError, match="conexion con jsm"):
        await service.list_available_request_types("TARG")

    service.jsm_project_client.get_service_desk_id.assert_not_called()


# verifica que el POST sin body sigue llamando al servicio como antes, solo con el project_key
@patch(ROUTER_SERVICE)
def test_post_without_body_keeps_the_previous_call(mock_service):
    mock_service.configure_request_types = AsyncMock(return_value=4)

    app.dependency_overrides[require_admin] = lambda: MagicMock(id="admin-1", role="admin")

    response = client.post("/api/config/itsm/projects/TARG/request-types")

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "request_types_configured": 4}
    mock_service.configure_request_types.assert_called_once_with("TARG")


# verifica que un body vacio tambien incorpora todos
@patch(ROUTER_SERVICE)
def test_post_with_empty_object_incorporates_every_type(mock_service):
    mock_service.configure_request_types = AsyncMock(return_value=4)

    app.dependency_overrides[require_admin] = lambda: MagicMock(id="admin-1", role="admin")

    response = client.post("/api/config/itsm/projects/TARG/request-types", json={})

    app.dependency_overrides.clear()

    assert response.status_code == 200
    mock_service.configure_request_types.assert_called_once_with("TARG")


# verifica que la lista de ids llega al servicio
@patch(ROUTER_SERVICE)
def test_post_with_ids_passes_them_to_the_service(mock_service):
    mock_service.configure_request_types = AsyncMock(return_value=2)

    app.dependency_overrides[require_admin] = lambda: MagicMock(id="admin-1", role="admin")

    response = client.post("/api/config/itsm/projects/TARG/request-types", json={"request_type_ids": ["10", "11"]})

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["request_types_configured"] == 2
    mock_service.configure_request_types.assert_called_once_with("TARG", ["10", "11"])


# verifica que una lista vacia llega al servicio y su error se traduce en HTTP 400
@patch(ROUTER_SERVICE)
def test_post_with_invalid_ids_returns_400(mock_service):
    mock_service.configure_request_types = AsyncMock(side_effect=ValueError("hay que indicar al menos un tipo de solicitud"))

    app.dependency_overrides[require_admin] = lambda: MagicMock(id="admin-1", role="admin")

    response = client.post("/api/config/itsm/projects/TARG/request-types", json={"request_type_ids": []})

    app.dependency_overrides.clear()

    assert response.status_code == 400
    assert "al menos un tipo" in response.json()["detail"]
    mock_service.configure_request_types.assert_called_once_with("TARG", [])


# verifica que el endpoint de los tipos disponibles devuelve 200 con el indicador de incorporado
@patch(ROUTER_SERVICE)
def test_get_available_returns_types_with_the_incorporated_flag(mock_service):
    mock_service.list_available_request_types = AsyncMock(return_value=[
        {"id": "10", "name": "Consulta", "incorporated": True},
        {"id": "11", "name": "Incidente", "incorporated": False},
    ])

    app.dependency_overrides[require_admin] = lambda: MagicMock(id="admin-1", role="admin")

    response = client.get("/api/config/itsm/projects/TARG/request-types/available")

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == {"request_types": [
        {"id": "10", "name": "Consulta", "incorporated": True},
        {"id": "11", "name": "Incidente", "incorporated": False},
    ]}
    mock_service.list_available_request_types.assert_called_once_with("TARG")


# verifica que un proyecto inexistente en el listado se traduce en HTTP 400 con el mensaje del servicio
@patch(ROUTER_SERVICE)
def test_get_available_unknown_project_returns_400(mock_service):
    mock_service.list_available_request_types = AsyncMock(side_effect=ValueError("project_key 'NOEXISTE' no existe"))

    app.dependency_overrides[require_admin] = lambda: MagicMock(id="admin-1", role="admin")

    response = client.get("/api/config/itsm/projects/NOEXISTE/request-types/available")

    app.dependency_overrides.clear()

    assert response.status_code == 400
    assert "no existe" in response.json()["detail"]


# verifica que en el contrato el body del POST es opcional y que la ruta de los tipos disponibles esta declarada
def test_post_body_is_optional_and_available_route_is_declared_in_the_contract():
    paths = main_app.openapi()["paths"]
    post = paths["/api/config/itsm/projects/{project_key}/request-types"]["post"]

    assert not post.get("requestBody", {}).get("required", False)
    assert "/api/config/itsm/projects/{project_key}/request-types/available" in paths
