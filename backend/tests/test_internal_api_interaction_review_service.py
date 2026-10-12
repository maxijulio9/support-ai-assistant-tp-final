"""Tests unitarios para InteractionReviewService.
Se mockean el repositorio, el historial, el generador, las credenciales de jsm, el cliente de jsm y la bd,
para verificar que cada accion de la revision guarde el canal de resolucion y no toque system_decision."""

import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from app.modules.internal_api.services.interaction_review_service import InteractionReviewService
from app.modules.response_generator.schemas import GeneratedResponse, ACTION_AUTO_PUBLISH, ACTION_ESCALATE

MODULE = "app.modules.internal_api.services.interaction_review_service"
CREDENTIALS = {"base_url": "https://example.atlassian.net", "user_email": "test@example.com", "api_token": "token-de-prueba"}


# arma el contexto que devuelve el repositorio para una interaccion en revision
def _build_context(**overrides) -> dict:
    defaults = {
        "issue_key": "TEST-1",
        "generated_response": "respuesta sugerida",
        "threshold_auto_publish": 0.85,
        "threshold_needs_review": 0.60,
        "retrieval": MagicMock(),
    }
    defaults.update(overrides)
    return defaults


# verifica que aprobar publica la respuesta y guarda el canal de aprobacion sin tocar system_decision
@patch(f"{MODULE}.get_db")
@patch(f"{MODULE}.JsmExecutor")
@patch(f"{MODULE}.JsmCredentialsRepository")
@patch(f"{MODULE}.ResponseGenerator")
@patch(f"{MODULE}.ConversationHistory")
@patch(f"{MODULE}.InteractionRepository")
@pytest.mark.asyncio
async def test_approve_interaction_sets_approved_channel(
    mock_repo_class, mock_history_class, mock_generator_class, mock_credentials_class, mock_jsm_class, mock_get_db,
):
    mock_repo_class.return_value.get_interaction_context.return_value = _build_context()
    mock_credentials_class.return_value.get_credentials.return_value = CREDENTIALS
    mock_jsm = MagicMock(post_comment=AsyncMock())
    mock_jsm_class.return_value = mock_jsm
    mock_db = MagicMock()
    mock_get_db.return_value = iter([mock_db])

    result = await InteractionReviewService().approve_interaction("int-1", "user-1")

    assert result == ACTION_AUTO_PUBLISH
    mock_jsm.post_comment.assert_called_once_with("TEST-1", "respuesta sugerida", public=True)
    sql = str(mock_db.execute.call_args[0][0])
    params = mock_db.execute.call_args[0][1]
    assert params["decision"] == ACTION_AUTO_PUBLISH
    assert params["resolution_channel"] == "REVIEWED_APPROVED"
    assert "system_decision" not in sql


# verifica que regenerar con resultado AUTO_PUBLISH publica el comentario y guarda el canal de regeneracion
@patch(f"{MODULE}.get_db")
@patch(f"{MODULE}.JsmExecutor")
@patch(f"{MODULE}.JsmCredentialsRepository")
@patch(f"{MODULE}.ResponseGenerator")
@patch(f"{MODULE}.ConversationHistory")
@patch(f"{MODULE}.InteractionRepository")
@pytest.mark.asyncio
async def test_regenerate_interaction_publishes_and_sets_regenerated_channel_when_auto_publish(
    mock_repo_class, mock_history_class, mock_generator_class, mock_credentials_class, mock_jsm_class, mock_get_db,
):
    mock_repo_class.return_value.get_interaction_context.return_value = _build_context()
    mock_history_class.return_value.get = AsyncMock(return_value=[])
    mock_generator_class.return_value.regenerate.return_value = GeneratedResponse(
        issue_key="TEST-1", action_type=ACTION_AUTO_PUBLISH, response_text="respuesta regenerada", confidence_score=0.9
    )
    mock_credentials_class.return_value.get_credentials.return_value = CREDENTIALS
    mock_jsm = MagicMock(post_comment=AsyncMock())
    mock_jsm_class.return_value = mock_jsm
    mock_db = MagicMock()
    mock_get_db.return_value = iter([mock_db])

    result = await InteractionReviewService().regenerate_interaction("int-1", "motivo del rechazo", "user-1")

    assert result == ACTION_AUTO_PUBLISH
    mock_jsm.post_comment.assert_called_once_with("TEST-1", "respuesta regenerada", public=True)
    sql = str(mock_db.execute.call_args[0][0])
    params = mock_db.execute.call_args[0][1]
    assert params["decision"] == ACTION_AUTO_PUBLISH
    assert params["rejection_reason"] == "motivo del rechazo"
    assert params["generated_response"] == "respuesta regenerada"
    assert params["resolution_channel"] == "REVIEWED_REGENERATED"
    assert "system_decision" not in sql


# verifica que regenerar con resultado ESCALATE no publica nada y guarda el mismo canal de regeneracion
@patch(f"{MODULE}.get_db")
@patch(f"{MODULE}.JsmExecutor")
@patch(f"{MODULE}.JsmCredentialsRepository")
@patch(f"{MODULE}.ResponseGenerator")
@patch(f"{MODULE}.ConversationHistory")
@patch(f"{MODULE}.InteractionRepository")
@pytest.mark.asyncio
async def test_regenerate_interaction_does_not_publish_and_sets_regenerated_channel_when_escalate(
    mock_repo_class, mock_history_class, mock_generator_class, mock_credentials_class, mock_jsm_class, mock_get_db,
):
    mock_repo_class.return_value.get_interaction_context.return_value = _build_context()
    mock_history_class.return_value.get = AsyncMock(return_value=[])
    mock_generator_class.return_value.regenerate.return_value = GeneratedResponse(issue_key="TEST-1", action_type=ACTION_ESCALATE)
    mock_db = MagicMock()
    mock_get_db.return_value = iter([mock_db])

    result = await InteractionReviewService().regenerate_interaction("int-1", "motivo del rechazo", "user-1")

    assert result == ACTION_ESCALATE
    mock_jsm_class.assert_not_called()
    mock_credentials_class.return_value.get_credentials.assert_not_called()
    params = mock_db.execute.call_args[0][1]
    assert params["decision"] == ACTION_ESCALATE
    assert params["resolution_channel"] == "REVIEWED_REGENERATED"


# verifica que escalar desde la revision guarda el canal de escalamiento humano
@patch(f"{MODULE}.get_db")
@patch(f"{MODULE}.JsmCredentialsRepository")
@patch(f"{MODULE}.ResponseGenerator")
@patch(f"{MODULE}.ConversationHistory")
@patch(f"{MODULE}.InteractionRepository")
def test_escalate_interaction_sets_escalated_by_human_channel(
    mock_repo_class, mock_history_class, mock_generator_class, mock_credentials_class, mock_get_db,
):
    mock_repo_class.return_value.get_interaction_context.return_value = _build_context()
    mock_db = MagicMock()
    mock_get_db.return_value = iter([mock_db])

    result = InteractionReviewService().escalate_interaction("int-1", "motivo", "user-1")

    assert result == "ESCALATE"
    sql = str(mock_db.execute.call_args[0][0])
    params = mock_db.execute.call_args[0][1]
    assert params["decision"] == "ESCALATE"
    assert params["resolution_channel"] == "ESCALATED_BY_HUMAN"
    assert "system_decision" not in sql


# verifica que el update nunca menciona system_decision y que sin canal no borra el que ya habia
@patch(f"{MODULE}.get_db")
@patch(f"{MODULE}.JsmCredentialsRepository")
@patch(f"{MODULE}.ResponseGenerator")
@patch(f"{MODULE}.ConversationHistory")
@patch(f"{MODULE}.InteractionRepository")
def test_update_interaction_does_not_touch_system_decision_nor_clear_channel(
    mock_repo_class, mock_history_class, mock_generator_class, mock_credentials_class, mock_get_db,
):
    mock_db = MagicMock()
    mock_get_db.return_value = iter([mock_db])

    InteractionReviewService()._update_interaction("int-1", decision="ESCALATE", reviewed_by="user-1")

    sql = str(mock_db.execute.call_args[0][0])
    params = mock_db.execute.call_args[0][1]
    assert "system_decision" not in sql
    assert "resolution_channel = COALESCE(:resolution_channel, resolution_channel)" in sql
    assert params["resolution_channel"] is None