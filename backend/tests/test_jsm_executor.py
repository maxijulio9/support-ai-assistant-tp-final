"""Tests unitarios para Modluo 5 - JSM Executor
Se utiliza mocks para simular las respuestas de la API de JSM y verificar que el módulo construye  las solicitudes."""

from unittest.mock import patch, MagicMock
from app.modules.jsm_executor.client import JsmExecutor

#crea una instancia del executor para usar en los tests
executor = JsmExecutor()

# verifica que post_comment envía el payload correcto para comentario publico
@patch("app.modules.jsm_executor.client.httpx.Client")
def test_post_comment_public(mock_client_class):
    mock_response = MagicMock()
    mock_response.json.return_value = {"id": "1", "body": "test", "public": True}
    mock_response.raise_for_status = MagicMock()

    mock_client = MagicMock()
    mock_client.post.return_value = mock_response
    mock_client_class.return_value.__enter__ = MagicMock(return_value=mock_client)
    mock_client_class.return_value.__exit__ = MagicMock(return_value=False)

    result = executor.post_comment("TEST-1", "respuesta de prueba", public=True)

    assert result["public"] is True
    assert result["body"] == "test"
    mock_client.post.assert_called_once()


# verifica que post_comment envía public=False para nota interna
@patch("app.modules.jsm_executor.client.httpx.Client")
def test_post_comment_internal(mock_client_class):
    mock_response = MagicMock()
    mock_response.json.return_value = {"id": "2", "body": "nota interna", "public": False}
    mock_response.raise_for_status = MagicMock()

    mock_client = MagicMock()
    mock_client.post.return_value = mock_response
    mock_client_class.return_value.__enter__ = MagicMock(return_value=mock_client)
    mock_client_class.return_value.__exit__ = MagicMock(return_value=False)

    result = executor.post_comment("TEST-1", "nota interna", public=False)

    assert result["public"] is False


# verifica que transition_issue retorna True cuando JSM responde 204
@patch("app.modules.jsm_executor.client.httpx.Client")
def test_transition_issue_success(mock_client_class):
    mock_response = MagicMock()
    mock_response.status_code = 204

    mock_client = MagicMock()
    mock_client.post.return_value = mock_response
    mock_client_class.return_value.__enter__ = MagicMock(return_value=mock_client)
    mock_client_class.return_value.__exit__ = MagicMock(return_value=False)

    result = executor.transition_issue("TEST-1", "21")

    assert result is True


# verifica que assign_issue retorna True cuando JSM responde 204
@patch("app.modules.jsm_executor.client.httpx.Client")
def test_assign_issue_success(mock_client_class):
    mock_response = MagicMock()
    mock_response.status_code = 204

    mock_client = MagicMock()
    mock_client.put.return_value = mock_response
    mock_client_class.return_value.__enter__ = MagicMock(return_value=mock_client)
    mock_client_class.return_value.__exit__ = MagicMock(return_value=False)

    result = executor.assign_issue("TEST-1", "abc123")

    assert result is True


# verifica que get_transitions retorna las transiciones disponibles
@patch("app.modules.jsm_executor.client.httpx.Client")
def test_get_transitions(mock_client_class):
    mock_response = MagicMock()
    mock_response.json.return_value = {
        "transitions": [
            {"id": "21", "name": "En progreso"},
            {"id": "31", "name": "Resuelto"},
        ]
    }
    mock_response.raise_for_status = MagicMock()

    mock_client = MagicMock()
    mock_client.get.return_value = mock_response
    mock_client_class.return_value.__enter__ = MagicMock(return_value=mock_client)
    mock_client_class.return_value.__exit__ = MagicMock(return_value=False)

    result = executor.get_transitions("TEST-1")

    assert len(result["transitions"]) == 2
    mock_client.get.assert_called_once()