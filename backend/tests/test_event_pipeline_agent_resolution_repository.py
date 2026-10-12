"""Tests unitarios para AgentResolutionRepository.
Se mockea la sesion de base de datos para verificar que arma bien las consultas,
sin tocar la bd real"""

import pytest
from unittest.mock import patch, MagicMock
from app.modules.event_pipeline.agent_resolution_repository import AgentResolutionRepository

DB_PATH = "app.modules.event_pipeline.agent_resolution_repository.get_db"


# verifica que al descartar una interaccion pendiente guarda el canal de resolucion externa sin tocar system_decision
@patch(DB_PATH)
def test_discard_pending_interaction_sets_externally_resolved_channel(mock_get_db):
    mock_db = MagicMock()
    mock_get_db.return_value = iter([mock_db])
    mock_db.execute.return_value.fetchone.return_value = MagicMock(id="int-1")

    result = AgentResolutionRepository().discard_pending_interaction("TEST-1")

    assert result is True
    update_call = mock_db.execute.call_args_list[-1]
    sql = str(update_call[0][0])
    params = update_call[0][1]
    assert params["id"] == "int-1"
    assert params["resolution_channel"] == "RESOLVED_EXTERNALLY"
    assert "decision = 'RESOLVED_EXTERNALLY'" in sql
    assert "system_decision" not in sql
    mock_db.commit.assert_called_once()


# verifica que si no hay interaccion pendiente no actualiza nada
@patch(DB_PATH)
def test_discard_pending_interaction_does_nothing_when_there_is_no_pending(mock_get_db):
    mock_db = MagicMock()
    mock_get_db.return_value = iter([mock_db])
    mock_db.execute.return_value.fetchone.return_value = None

    result = AgentResolutionRepository().discard_pending_interaction("TEST-1")

    assert result is False
    assert mock_db.execute.call_count == 1
    mock_db.commit.assert_not_called()


# verifica que si falla la bd deshace los cambios y relanza el error
@patch(DB_PATH)
def test_discard_pending_interaction_rolls_back_and_raises_on_error(mock_get_db):
    mock_db = MagicMock()
    mock_get_db.return_value = iter([mock_db])
    mock_db.execute.side_effect = Exception("falla de bd")

    with pytest.raises(Exception):
        AgentResolutionRepository().discard_pending_interaction("TEST-1")

    mock_db.rollback.assert_called_once()