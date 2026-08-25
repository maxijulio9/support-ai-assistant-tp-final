"""Tests unitarios para el router de M7 - InternalAPI (endpoint de CU27)."""

from unittest.mock import patch
from fastapi.testclient import TestClient
from fastapi import FastAPI
from app.modules.internal_api.router import router

app = FastAPI()
app.include_router(router)
client = TestClient(app)


def _build_request_body(**overrides):
    defaults = {
        "thresholds": {
            "project_id": "proj-1",
            "threshold_auto_publish": 0.85,
            "threshold_needs_review": 0.60,
            "similarity_threshold": 0.40,
        },
        "status_mappings": [
            {"project_id": "proj-1", "status_id": "status-1", "system_action": "21", "is_active": True}
        ],
    }
    defaults.update(overrides)
    return defaults


# verifica que el endpoint responde 200 y delega correctamente al service
@patch("app.modules.internal_api.router._service")
def test_configure_project_success(mock_service):
    mock_service.save_config.return_value = 1

    response = client.post("/api/config/itsm/projects", json=_build_request_body())

    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["mappings_configured"] == 1


# verifica que un ValueError del service se traduce en HTTP 400
@patch("app.modules.internal_api.router._service")
def test_configure_project_invalid_mapping_returns_400(mock_service):
    mock_service.save_config.side_effect = ValueError("cada mapeo necesita project_id y status_id")

    response = client.post("/api/config/itsm/projects", json=_build_request_body())

    assert response.status_code == 400


# verifica que un error inesperado del service se traduce en HTTP 503
@patch("app.modules.internal_api.router._service")
def test_configure_project_db_failure_returns_503(mock_service):
    mock_service.save_config.side_effect = Exception("fallo de conexion")

    response = client.post("/api/config/itsm/projects", json=_build_request_body())

    assert response.status_code == 503