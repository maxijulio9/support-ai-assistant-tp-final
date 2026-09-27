"""Tests unitarios para token_denylist (M9).
Se mockea el cliente de Redis y datetime.now, sin tocar Redis real."""

from unittest.mock import patch, AsyncMock
from datetime import datetime, timezone
import pytest
from app.modules.auth.token_denylist import add_to_denylist


# verifica que con un exp futuro, calcula el ttl restante y llama a redis.set con ese ttl
@patch("app.modules.auth.token_denylist.get_redis")
@patch("app.modules.auth.token_denylist.datetime")
@pytest.mark.asyncio
async def test_add_to_denylist_with_positive_ttl(mock_datetime, mock_get_redis):
    ahora = datetime(2026, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
    mock_datetime.now.return_value = ahora
    exp = int(ahora.timestamp()) + 100

    mock_redis = AsyncMock()
    mock_get_redis.return_value = mock_redis

    await add_to_denylist("jti-1", exp)

    mock_redis.set.assert_called_once_with("jwt_denylist:jti-1", "1", ex=100)


# verifica que con un exp ya vencido, no llama a redis en absoluto
@patch("app.modules.auth.token_denylist.get_redis")
@patch("app.modules.auth.token_denylist.datetime")
@pytest.mark.asyncio
async def test_add_to_denylist_with_expired_token(mock_datetime, mock_get_redis):
    ahora = datetime(2026, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
    mock_datetime.now.return_value = ahora
    exp = int(ahora.timestamp()) - 10

    mock_redis = AsyncMock()
    mock_get_redis.return_value = mock_redis

    await add_to_denylist("jti-1", exp)

    mock_redis.set.assert_not_called()