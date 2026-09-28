"""Tests unitarios para UserManagementService (M9).
Se mockea AppUserRepository, sin tocar la bd real. El hashing corre real (bcrypt)."""

from unittest.mock import patch
import pytest
from app.modules.auth.services.user_management_service import UserManagementService
from app.modules.auth.schemas import AppUser


def _build_app_user(**overrides):
    defaults = {
        "id": "user-1",
        "email": "existente@tokenia.com",
        "password_hash": "$2b$12$hasheado",
        "full_name": "Usuario Existente",
        "role": "admin",
        "is_active": True,
        "created_at": "2026-09-26T00:00:00Z",
        "updated_at": "2026-09-26T00:00:00Z",
    }
    defaults.update(overrides)
    return AppUser(**defaults)


# verifica que list_users delega directo en el repositorio
@patch("app.modules.auth.services.user_management_service.AppUserRepository")
def test_list_users_returns_repository_result(mock_repository_class):
    mock_repository_class.return_value.list_all.return_value = [_build_app_user()]

    service = UserManagementService()
    result = service.list_users()

    assert len(result) == 1
    assert result[0].email == "existente@tokenia.com"


# verifica que create_user hashea la password antes de guardar, no la guarda en texto plano
@patch("app.modules.auth.services.user_management_service.AppUserRepository")
def test_create_user_hashes_password(mock_repository_class):
    mock_repository_class.return_value.get_by_email.return_value = None
    mock_repository_class.return_value.create.return_value = _build_app_user(email="nuevo@tokenia.com")

    service = UserManagementService()
    service.create_user("nuevo@tokenia.com", "Password123!", "Usuario Nuevo", "agent")

    args_enviados = mock_repository_class.return_value.create.call_args[0]
    password_hash_enviado = args_enviados[1]

    assert password_hash_enviado != "Password123!"
    assert password_hash_enviado.startswith("$2b$")


# verifica que rechaza si el email ya existe, sin llegar a crear nada
@patch("app.modules.auth.services.user_management_service.AppUserRepository")
def test_create_user_rejects_duplicate_email(mock_repository_class):
    mock_repository_class.return_value.get_by_email.return_value = _build_app_user()

    service = UserManagementService()

    with pytest.raises(ValueError, match="el email ya esta registrado"):
        service.create_user("existente@tokenia.com", "Password123!", "Otro Nombre", "agent")

    mock_repository_class.return_value.create.assert_not_called()