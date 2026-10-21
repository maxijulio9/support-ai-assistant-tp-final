"""Tests unitarios para el descarte de la sugerencia de una interaccion pendiente de revision.
Se mockean la base de datos y el servicio, sin tocar nada real."""

import pytest
from unittest.mock import patch, MagicMock
from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.main import app as main_app
from app.modules.auth.dependencies import get_current_user
from app.modules.internal_api.router import router
from app.modules.internal_api.services.interaction_review_service import (
    InteractionReviewService,
    InteractionNotPendingError,
)

SERVICE_DB = "app.modules.internal_api.services.interaction_review_service.get_db"
ROUTER_SERVICE = "app.modules.internal_api.router._review_service"
INTERACTION_ID = "3f2504e0-4f89-41d3-9a0c-3d4f1e2b6a10"

app = FastAPI()
app.include_router(router)
client = TestClient(app)


# arma el servicio sin construir sus dependencias, el descarte no usa ninguna
def _service():
    return InteractionReviewService.__new__(InteractionReviewService)


# arma el resultado simulado de una consulta
def _result(row=None):
    result = MagicMock()
    result.fetchone.return_value = row
    return result


# hace que el endpoint vea a un usuario autenticado
def _as_agent():
    app.dependency_overrides[get_current_user] = lambda: MagicMock(id="user-1", role="agent")


# verifica que el descarte actualiza la interaccion con la decision y el canal nuevos, y confirma la transaccion
@patch(SERVICE_DB)
def test_discard_updates_the_interaction_and_commits(mock_get_db):
    mock_db = MagicMock()
    mock_db.execute.return_value = _result(MagicMock(id=INTERACTION_ID))
    mock_get_db.return_value = iter([mock_db])

    result = _service().discard_interaction(INTERACTION_ID, "lo atiendo yo", "user-1")

    params = mock_db.execute.call_args[0][1]
    assert result == "DISCARDED"
    assert params["decision"] == "DISCARDED"
    assert params["pending_decision"] == "NEEDS_REVIEW"
    assert params["resolution_channel"] == "DISCARDED_BY_HUMAN"
    assert params["rejection_reason"] == "lo atiendo yo"
    assert params["reviewed_by"] == "user-1"
    mock_db.commit.assert_called_once()


# verifica que sin motivo se manda null, y la consulta conserva el motivo que ya hubiera
@patch(SERVICE_DB)
def test_discard_without_a_reason_sends_null(mock_get_db):
    mock_db = MagicMock()
    mock_db.execute.return_value = _result(MagicMock(id=INTERACTION_ID))
    mock_get_db.return_value = iter([mock_db])

    _service().discard_interaction(INTERACTION_ID, None, "user-1")

    assert mock_db.execute.call_args[0][1]["rejection_reason"] is None


# verifica que una interaccion que no existe lanza ValueError y no confirma nada
@patch(SERVICE_DB)
def test_discard_unknown_interaction_raises_value_error(mock_get_db):
    mock_db = MagicMock()
    mock_db.execute.side_effect = [_result(None), _result(None)]
    mock_get_db.return_value = iter([mock_db])

    with pytest.raises(ValueError, match="no encontrada"):
        _service().discard_interaction(INTERACTION_ID, None, "user-1")

    mock_db.commit.assert_not_called()
    mock_db.rollback.assert_called_once()


# verifica que una interaccion que existe pero ya no esta pendiente lanza el error de conflicto y no confirma nada
@patch(SERVICE_DB)
def test_discard_not_pending_raises_the_conflict_error(mock_get_db):
    mock_db = MagicMock()
    mock_db.execute.side_effect = [_result(None), _result(MagicMock())]
    mock_get_db.return_value = iter([mock_db])

    with pytest.raises(InteractionNotPendingError, match="ya no esta pendiente"):
        _service().discard_interaction(INTERACTION_ID, None, "user-1")

    mock_db.commit.assert_not_called()


# verifica que un id mal formado se trata como no encontrado, sin tocar la base
@patch(SERVICE_DB)
def test_discard_malformed_id_is_not_found_without_touching_the_database(mock_get_db):
    with pytest.raises(ValueError, match="no encontrada"):
        _service().discard_interaction("no-es-un-uuid", None, "user-1")

    mock_get_db.assert_not_called()


# verifica que un error inesperado de la base deshace la transaccion y se relanza
@patch(SERVICE_DB)
def test_discard_rolls_back_on_an_unexpected_error(mock_get_db):
    mock_db = MagicMock()
    mock_db.execute.side_effect = Exception("falla de bd")
    mock_get_db.return_value = iter([mock_db])

    with pytest.raises(Exception, match="falla de bd"):
        _service().discard_interaction(INTERACTION_ID, None, "user-1")

    mock_db.rollback.assert_called_once()
    mock_db.commit.assert_not_called()


# verifica que el endpoint devuelve 200 con action_type DISCARDED, recorta el motivo y toma el revisor del token
@patch(ROUTER_SERVICE)
def test_endpoint_returns_ok_trims_the_reason_and_uses_the_token_user(mock_service):
    mock_service.discard_interaction.return_value = "DISCARDED"
    _as_agent()

    response = client.post("/api/interactions/abc/discard", json={"rejection_reason": "  lo atiendo yo  "})

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "action_type": "DISCARDED"}
    mock_service.discard_interaction.assert_called_once_with("abc", "lo atiendo yo", "user-1")


# verifica que el endpoint funciona sin body
@patch(ROUTER_SERVICE)
def test_endpoint_works_without_a_body(mock_service):
    mock_service.discard_interaction.return_value = "DISCARDED"
    _as_agent()

    response = client.post("/api/interactions/abc/discard")

    app.dependency_overrides.clear()

    assert response.status_code == 200
    mock_service.discard_interaction.assert_called_once_with("abc", None, "user-1")


# verifica que un motivo en blanco se trata como si no hubiera motivo
@patch(ROUTER_SERVICE)
def test_endpoint_blank_reason_is_treated_as_none(mock_service):
    mock_service.discard_interaction.return_value = "DISCARDED"
    _as_agent()

    client.post("/api/interactions/abc/discard", json={"rejection_reason": "   "})

    app.dependency_overrides.clear()

    mock_service.discard_interaction.assert_called_once_with("abc", None, "user-1")


# verifica que un revisor mandado en el body se ignora, siempre manda el del token
@patch(ROUTER_SERVICE)
def test_endpoint_ignores_a_reviewer_sent_in_the_body(mock_service):
    mock_service.discard_interaction.return_value = "DISCARDED"
    _as_agent()

    client.post("/api/interactions/abc/discard", json={"rejection_reason": "x", "reviewed_by": "otra-persona"})

    app.dependency_overrides.clear()

    mock_service.discard_interaction.assert_called_once_with("abc", "x", "user-1")


# verifica que una interaccion inexistente se traduce en HTTP 404 con el mensaje del servicio
@patch(ROUTER_SERVICE)
def test_endpoint_unknown_interaction_returns_404(mock_service):
    mock_service.discard_interaction.side_effect = ValueError("interaction 'abc' no encontrada")
    _as_agent()

    response = client.post("/api/interactions/abc/discard")

    app.dependency_overrides.clear()

    assert response.status_code == 404
    assert "no encontrada" in response.json()["detail"]


# verifica que una interaccion que ya no esta pendiente se traduce en HTTP 409 con el mensaje del servicio
@patch(ROUTER_SERVICE)
def test_endpoint_not_pending_returns_409(mock_service):
    mock_service.discard_interaction.side_effect = InteractionNotPendingError("interaction 'abc' ya no esta pendiente de revision")
    _as_agent()

    response = client.post("/api/interactions/abc/discard")

    app.dependency_overrides.clear()

    assert response.status_code == 409
    assert "ya no esta pendiente" in response.json()["detail"]


# verifica que un error inesperado se traduce en HTTP 503
@patch(ROUTER_SERVICE)
def test_endpoint_unexpected_error_returns_503(mock_service):
    mock_service.discard_interaction.side_effect = Exception("falla de bd")
    _as_agent()

    response = client.post("/api/interactions/abc/discard")

    app.dependency_overrides.clear()

    assert response.status_code == 503


# verifica en el contrato que la ruta declara los errores 404 y 409 y que el body es opcional
def test_discard_route_is_declared_with_its_errors_and_an_optional_body():
    post = main_app.openapi()["paths"]["/api/interactions/{interaction_id}/discard"]["post"]

    assert {"200", "404", "409"} <= set(post["responses"])
    assert not post.get("requestBody", {}).get("required", False)
