"""Tests unitarios para AuthService M9 
Se mockea AppUserRepository para verificar la logica de login sin tocar la bd real.
El hashing de password corre real (bcrypt), no se mockea, para probar el flujo completo."""

from unittest.mock import patch, AsyncMock
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


# verifica que logout delega en add_to_denylist con el jti y el exp del token
@patch("app.modules.auth.services.auth_service.add_to_denylist", new_callable=AsyncMock)
@pytest.mark.asyncio
async def test_logout_calls_add_to_denylist(mock_add_to_denylist):
    service = AuthService()

    await service.logout("jti-1", 1790520478)

    mock_add_to_denylist.assert_called_once_with("jti-1", 1790520478)



# verifica que forgot_password manda el mail si el usuario existe y esta activo
@patch("app.modules.auth.services.auth_service.SendGridClient")
@patch("app.modules.auth.services.auth_service.create_reset_token", new_callable=AsyncMock)
@patch("app.modules.auth.services.auth_service.AppUserRepository")
@pytest.mark.asyncio
async def test_forgot_password_sends_email_when_user_exists(mock_repository_class, mock_create_token, mock_email_client_class):
    mock_repository_class.return_value.get_by_email.return_value = _build_app_user()
    mock_create_token.return_value = "token-de-prueba"
    mock_email_client = AsyncMock()
    mock_email_client_class.return_value = mock_email_client

    service = AuthService()
    await service.forgot_password("test@tokenia.com")

    mock_email_client.send_email.assert_called_once()
    mock_email_client.close.assert_called_once()

# verifica que forgot_password no manda mail si el usuario no existe, pero tampoco lanza excepcion
@patch("app.modules.auth.services.auth_service.SendGridClient")
@patch("app.modules.auth.services.auth_service.AppUserRepository")
@pytest.mark.asyncio
async def test_forgot_password_silent_when_user_not_found(mock_repository_class, mock_email_client_class):
    mock_repository_class.return_value.get_by_email.return_value = None

    service = AuthService()
    await service.forgot_password("nadie@tokenia.com")

    mock_email_client_class.assert_not_called()

# verifica que forgot_password no manda mail si el usuario esta inactivo
@patch("app.modules.auth.services.auth_service.SendGridClient")
@patch("app.modules.auth.services.auth_service.AppUserRepository")
@pytest.mark.asyncio
async def test_forgot_password_silent_when_user_inactive(mock_repository_class, mock_email_client_class):
    mock_repository_class.return_value.get_by_email.return_value = _build_app_user(is_active=False)

    service = AuthService()
    await service.forgot_password("test@tokenia.com")

    mock_email_client_class.assert_not_called()

# verifica que reset_password cambia la password y consume el token cuando es valido
@patch("app.modules.auth.services.auth_service.consume_reset_token", new_callable=AsyncMock)
@patch("app.modules.auth.services.auth_service.get_user_id_from_token", new_callable=AsyncMock)
@patch("app.modules.auth.services.auth_service.AppUserRepository")
@pytest.mark.asyncio
async def test_reset_password_success(mock_repository_class, mock_get_user_id, mock_consume_token):
    mock_get_user_id.return_value = "user-1"

    service = AuthService()
    await service.reset_password("token-valido", "NuevaClave123!")

    mock_repository_class.return_value.update_password.assert_called_once()
    mock_consume_token.assert_called_once_with("token-valido")

# verifica que reset_password rechaza un token invalido sin tocar la password
@patch("app.modules.auth.services.auth_service.get_user_id_from_token", new_callable=AsyncMock)
@patch("app.modules.auth.services.auth_service.AppUserRepository")
@pytest.mark.asyncio
async def test_reset_password_invalid_token(mock_repository_class, mock_get_user_id):
    mock_get_user_id.return_value = None

    service = AuthService()

    with pytest.raises(ValueError, match="token invalido o vencido"):
        await service.reset_password("token-invalido", "NuevaClave123!")

    mock_repository_class.return_value.update_password.assert_not_called()