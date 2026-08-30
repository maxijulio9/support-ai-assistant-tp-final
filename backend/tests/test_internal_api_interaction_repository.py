"""Tests unitarios para InteractionRepository (M7).
Se mockea la sesion de base de datos para verificar que arma el contexto correctamente,
sin tocar la bd real."""

from unittest.mock import patch, MagicMock
from app.modules.internal_api.interaction_repository import InteractionRepository


# arma una fila simulada de interaction+ticket
def _build_interaction_row(**overrides):
    defaults = {
        "generated_response": "respuesta generada original",
        "issue_key": "TARG-1",
        "project_id": "proj-1",
    }
    defaults.update(overrides)
    row = MagicMock()
    for key, value in defaults.items():
        setattr(row, key, value)
    return row


# arma una fila simulada de chunk recuperado
def _build_chunk_row(**overrides):
    defaults = {
        "chunk_id": "chunk-1",
        "content": "contenido de ejemplo",
        "similarity_score": 0.8,
        "page_title": "Como resetear password",
        "category": "acceso_autenticacion",
        "doc_type": "resolution",
    }
    defaults.update(overrides)
    row = MagicMock()
    for key, value in defaults.items():
        setattr(row, key, value)
    return row


# verifica que arma el contexto completo cuando la interaccion existe, con chunks y umbrales reales
@patch("app.modules.internal_api.interaction_repository.get_db")
def test_get_interaction_context_success(mock_get_db):
    mock_db = MagicMock()
    mock_get_db.return_value = iter([mock_db])

    interaction_row = _build_interaction_row()
    chunk_row = _build_chunk_row()
    threshold_row = MagicMock(threshold_auto_publish=0.90, threshold_needs_review=0.55)

    mock_db.execute.return_value.fetchone.side_effect = [interaction_row, threshold_row]
    mock_db.execute.return_value.fetchall.return_value = [chunk_row]

    repo = InteractionRepository()
    result = repo.get_interaction_context("interaction-1")

    assert result["issue_key"] == "TARG-1"
    assert result["project_id"] == "proj-1"
    assert result["threshold_auto_publish"] == 0.90
    assert result["threshold_needs_review"] == 0.55
    assert len(result["retrieval"].chunks) == 1
    assert result["retrieval"].chunks[0].content == "contenido de ejemplo"


# verifica que devuelve None si la interaccion no existe
@patch("app.modules.internal_api.interaction_repository.get_db")
def test_get_interaction_context_not_found(mock_get_db):
    mock_db = MagicMock()
    mock_get_db.return_value = iter([mock_db])
    mock_db.execute.return_value.fetchone.return_value = None

    repo = InteractionRepository()
    result = repo.get_interaction_context("interaction-inexistente")

    assert result is None


# verifica que usa los defaults si el proyecto no tiene umbrales configurados
@patch("app.modules.internal_api.interaction_repository.get_db")
def test_get_interaction_context_uses_default_thresholds_when_project_not_found(mock_get_db):
    mock_db = MagicMock()
    mock_get_db.return_value = iter([mock_db])

    interaction_row = _build_interaction_row()

    mock_db.execute.return_value.fetchone.side_effect = [interaction_row, None]
    mock_db.execute.return_value.fetchall.return_value = []

    repo = InteractionRepository()
    result = repo.get_interaction_context("interaction-1")

    assert result["threshold_auto_publish"] == 0.85
    assert result["threshold_needs_review"] == 0.60
    assert result["retrieval"].chunks == []
    