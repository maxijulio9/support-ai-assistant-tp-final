"""Tests unitarios para password_reset_token 
Se mockea el cliente de Redis, sin tocar Redis real"""

from unittest.mock import patch, AsyncMock
import pytest
from app.modules.auth.password_reset_token import (
    create_reset_token,
    get_user_id_from_token,
    consume_reset_token,
    TTL_SEGUNDOS,
)


# verifica que create_reset_token genera un token y lo guarda en redis con el ttl correcto
@patch("app.modules.auth.password_reset_token.secrets.token_urlsafe")
@patch("app.modules.auth.password_reset_token.get_redis")
@pytest.mark.asyncio
async def test_create_reset_token_saves_with_ttl(mock_get_redis, mock_token_urlsafe):
    mock_token_urlsafe.return_value = "token-de-prueba"
    mock_redis = AsyncMock()
    mock_get_redis.return_value = mock_redis

    token = await create_reset_token("user-1")

    assert token == "token-de-prueba"
    mock_redis.set.assert_called_once_with("password_reset:token-de-prueba", "user-1", ex=TTL_SEGUNDOS)


# verifica que get_user_id_from_token devuelve el user_id guardado
@patch("app.modules.auth.password_reset_token.get_redis")
@pytest.mark.asyncio
async def test_get_user_id_from_token_found(mock_get_redis):
    mock_redis = AsyncMock()
    mock_redis.get.return_value = "user-1"
    mock_get_redis.return_value = mock_redis

    result = await get_user_id_from_token("token-de-prueba")

    assert result == "user-1"


# verifica que get_user_id_from_token devuelve None si el token no existe o vencio
@patch("app.modules.auth.password_reset_token.get_redis")
@pytest.mark.asyncio
async def test_get_user_id_from_token_not_found(mock_get_redis):
    mock_redis = AsyncMock()
    mock_redis.get.return_value = None
    mock_get_redis.return_value = mock_redis

    result = await get_user_id_from_token("token-inexistente")

    assert result is None


# verifica que consume_reset_token borra la clave de redis
@patch("app.modules.auth.password_reset_token.get_redis")
@pytest.mark.asyncio
async def test_consume_reset_token_deletes_key(mock_get_redis):
    mock_redis = AsyncMock()
    mock_get_redis.return_value = mock_redis

    await consume_reset_token("token-de-prueba")

    mock_redis.delete.assert_called_once_with("password_reset:token-de-prueba")