"""Tests unitarios para AppUserRepository (M9).
Se mockea la sesion de base de datos para verificar que arma AppUser correctamente,
sin tocar la bd real."""

from unittest.mock import patch, MagicMock
from app.modules.auth.repositories.app_user_repository import AppUserRepository


# arma una fila simulada de app_user
def _build_app_user_row(**overrides):
    defaults = {
        "id": "user-1",
        "email": "test@tokenia.com",
        "password_hash": "$2b$12$hasheado",
        "full_name": "Usuario de prueba",
        "role": "admin",
        "is_active": True,
        "created_at": "2026-09-26T00:00:00Z",
        "updated_at": "2026-09-26T00:00:00Z",
    }
    defaults.update(overrides)
    row = MagicMock()
    for key, value in defaults.items():
        setattr(row, key, value)
    return row


# verifica que arma el AppUser correctamente cuando el email existe
@patch("app.modules.auth.repositories.app_user_repository.get_db")
def test_get_by_email_success(mock_get_db):
    mock_db = MagicMock()
    mock_get_db.return_value = iter([mock_db])
    mock_db.execute.return_value.fetchone.return_value = _build_app_user_row()

    repo = AppUserRepository()
    result = repo.get_by_email("test@tokenia.com")

    assert result.email == "test@tokenia.com"
    assert result.role == "admin"
    assert result.is_active is True


# verifica que devuelve None si el email no existe
@patch("app.modules.auth.repositories.app_user_repository.get_db")
def test_get_by_email_not_found(mock_get_db):
    mock_db = MagicMock()
    mock_get_db.return_value = iter([mock_db])
    mock_db.execute.return_value.fetchone.return_value = None

    repo = AppUserRepository()
    result = repo.get_by_email("nadie@tokenia.com")

    assert result is None


# verifica que trae al usuario aunque este inactivo, la decision de que hacer con eso es del service
@patch("app.modules.auth.repositories.app_user_repository.get_db")
def test_get_by_email_returns_inactive_user_too(mock_get_db):
    mock_db = MagicMock()
    mock_get_db.return_value = iter([mock_db])
    mock_db.execute.return_value.fetchone.return_value = _build_app_user_row(is_active=False)

    repo = AppUserRepository()
    result = repo.get_by_email("test@tokenia.com")

    assert result is not None
    assert result.is_active is False