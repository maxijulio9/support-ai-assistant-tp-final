"""Tests unitarios para SendGridClient (M9).
Se mockea httpx, sin mandar emails reales ni consumir cuota de SendGrid."""

from unittest.mock import patch, AsyncMock, MagicMock
import pytest
from app.modules.auth.sendgrid_client import SendGridClient


# verifica que send_email arma el payload correcto y devuelve True con un 202
@patch("app.modules.auth.sendgrid_client.httpx.AsyncClient")
@pytest.mark.asyncio
async def test_send_email_success(mock_async_client_class):
    mock_client = AsyncMock()
    mock_response = MagicMock(status_code=202)
    mock_response.raise_for_status = MagicMock()
    mock_client.post.return_value = mock_response
    mock_async_client_class.return_value = mock_client

    client = SendGridClient()
    resultado = await client.send_email("destino@tokenia.com", "Asunto de prueba", "Cuerpo de prueba")

    assert resultado is True

    llamada = mock_client.post.call_args
    payload = llamada.kwargs["json"]
    assert payload["personalizations"][0]["to"][0]["email"] == "destino@tokenia.com"
    assert payload["tracking_settings"]["click_tracking"]["enable"] is False


# verifica que un error http se propaga (raise_for_status hace su trabajo)
@patch("app.modules.auth.sendgrid_client.httpx.AsyncClient")
@pytest.mark.asyncio
async def test_send_email_propagates_http_error(mock_async_client_class):
    import httpx

    mock_client = AsyncMock()
    mock_response = MagicMock(status_code=401)
    mock_response.raise_for_status = MagicMock(side_effect=httpx.HTTPStatusError(
        "unauthorized", request=MagicMock(), response=mock_response
    ))
    mock_client.post.return_value = mock_response
    mock_async_client_class.return_value = mock_client

    client = SendGridClient()

    with pytest.raises(httpx.HTTPStatusError):
        await client.send_email("destino@tokenia.com", "Asunto", "Cuerpo")