"""Tests unitarios para jwt_handler (M9). Corren PyJWT real, sin mocks."""

import jwt
import pytest
from app.core.config import settings
from app.modules.auth.jwt_handler import create_access_token


def test_create_access_token_contains_expected_claims():
    token = create_access_token("user-1", "admin")

    payload = jwt.decode(token, settings.jwt_secret_key, algorithms=["HS256"])

    assert payload["sub"] == "user-1"
    assert payload["role"] == "admin"
    assert "jti" in payload
    assert "iat" in payload
    assert "exp" in payload


def test_create_access_token_generates_unique_jti_each_time():
    token_1 = create_access_token("user-1", "admin")
    token_2 = create_access_token("user-1", "admin")

    payload_1 = jwt.decode(token_1, settings.jwt_secret_key, algorithms=["HS256"])
    payload_2 = jwt.decode(token_2, settings.jwt_secret_key, algorithms=["HS256"])

    assert payload_1["jti"] != payload_2["jti"]


def test_create_access_token_fails_with_wrong_secret():
    token = create_access_token("user-1", "admin")

    with pytest.raises(jwt.InvalidSignatureError):
        jwt.decode(token, "clave-incorrecta", algorithms=["HS256"])