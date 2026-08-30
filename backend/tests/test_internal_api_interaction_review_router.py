"""Tests unitarios para los endpoints de revision de interacciones: approve/regenerate/escalate"""

from unittest.mock import patch, AsyncMock, MagicMock
from fastapi.testclient import TestClient
from fastapi import FastAPI
from app.modules.internal_api.router import router

app = FastAPI()
app.include_router(router)
client = TestClient(app)


# verifica que approve responde 200 y delega al service
@patch("app.modules.internal_api.router._review_service")
def test_approve_interaction_success(mock_review_service):
    mock_review_service.approve_interaction = AsyncMock(return_value="AUTO_PUBLISH")

    response = client.post("/api/interactions/interaction-1/approve", json={"reviewed_by": "agent-1"})

    assert response.status_code == 200
    assert response.json()["action_type"] == "AUTO_PUBLISH"


# verifica que approve responde 404 si la interaccion no existe
@patch("app.modules.internal_api.router._review_service")
def test_approve_interaction_not_found(mock_review_service):
    mock_review_service.approve_interaction = AsyncMock(side_effect=ValueError("no encontrada"))

    response = client.post("/api/interactions/interaction-x/approve", json={})

    assert response.status_code == 404


# verifica que regenerate responde 200 con el action_type que devuelve el service
@patch("app.modules.internal_api.router._review_service")
def test_regenerate_interaction_success(mock_review_service):
    mock_review_service.regenerate_interaction = AsyncMock(return_value="ESCALATE")

    response = client.post("/api/interactions/interaction-1/regenerate", json={"rejection_reason": "no aplica"})

    assert response.status_code == 200
    assert response.json()["action_type"] == "ESCALATE"


# verifica que regenerate exige rejection_reason (falla de validacion de pydantic, no del service)
def test_regenerate_interaction_requires_reason():
    response = client.post("/api/interactions/interaction-1/regenerate", json={})

    assert response.status_code == 422


# verifica que escalate responde 200
@patch("app.modules.internal_api.router._review_service")
def test_escalate_interaction_success(mock_review_service):
    mock_review_service.escalate_interaction = MagicMock(return_value="ESCALATE")

    response = client.post("/api/interactions/interaction-1/escalate", json={})

    assert response.status_code == 200
    assert response.json()["action_type"] == "ESCALATE"


# verifica que cualquier endpoint responde 503 si el service falla inesperadamente
@patch("app.modules.internal_api.router._review_service")
def test_approve_interaction_db_failure_returns_503(mock_review_service):
    mock_review_service.approve_interaction = AsyncMock(side_effect=Exception("fallo de conexion"))

    response = client.post("/api/interactions/interaction-1/approve", json={})

    assert response.status_code == 503