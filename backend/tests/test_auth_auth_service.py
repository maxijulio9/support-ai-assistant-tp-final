"""Tests unitarios para AuthService M9 
Se mockea AppUserRepository para verificar la logica de login sin tocar la bd real.
El hashing de password corre real (bcrypt), no se mockea, para probar el flujo completo."""

from unittest.mock import patch
import pytest
from app.modules.auth.services.auth_service import AuthService
from app.modules.auth.schemas import AppUser
from app.modules.auth.password_hasher import hash_password


def _build_app_user(**overrides):
    defaults = {
        "id": "user-1",
        "email": "test@tokenia.com",
        "password_hash": hash_password("Test1234!"),
        "full_name": "Usuario de prueba",
        "role": "admin",
        "is_active": True,
        "created_at": "2026-09-26T00:00:00Z",
        "updated_at": "2026-09-26T00:00:00Z",
    }
    defaults.update(overrides)
    return AppUser(**defaults)


# verifica que con credenciales correctas devuelve token y role
@patch("app.modules.auth.services.auth_service.AppUserRepository")
def test_login_success(mock_repository_class):
    mock_repository_class.return_value.get_by_email.return_value = _build_app_user()

    service = AuthService()
    result = service.login("test@tokenia.com", "Test1234!")

    assert "access_token" in result
    assert result["role"] == "admin"


# verifica que rechaza con el mismo mensaje generico si la password esta mal
@patch("app.modules.auth.services.auth_service.AppUserRepository")
def test_login_wrong_password(mock_repository_class):
    mock_repository_class.return_value.get_by_email.return_value = _build_app_user()

    service = AuthService()

    with pytest.raises(ValueError, match="credenciales invalidas"):
        service.login("test@tokenia.com", "ContraseñaMala")


# verifica que rechaza con el mismo mensaje generico si el usuario no existe
@patch("app.modules.auth.services.auth_service.AppUserRepository")
def test_login_user_not_found(mock_repository_class):
    mock_repository_class.return_value.get_by_email.return_value = None

    service = AuthService()

    with pytest.raises(ValueError, match="credenciales invalidas"):
        service.login("nadie@tokenia.com", "cualquiera")


# verifica que rechaza con el mismo mensaje generico si la cuenta esta inactiva
@patch("app.modules.auth.services.auth_service.AppUserRepository")
def test_login_inactive_user(mock_repository_class):
    mock_repository_class.return_value.get_by_email.return_value = _build_app_user(is_active=False)

    service = AuthService()

    with pytest.raises(ValueError, match="credenciales invalidas"):
        service.login("test@tokenia.com", "Test1234!")