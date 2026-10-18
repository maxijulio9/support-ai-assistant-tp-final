"""Tests unitarios para el estado de las conexiones con JSM y con Confluence.
Se mockean la base de datos, el cifrado y el servicio, sin tocar nada real."""

from unittest.mock import patch, MagicMock
from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.modules.auth.dependencies import require_admin
from app.modules.internal_api.router import router
from app.modules.internal_api.repositories.jsm_credentials_repository import JsmCredentialsRepository
from app.modules.internal_api.repositories.confluence_credentials_repository import ConfluenceCredentialsRepository
from app.modules.internal_api.services.connection_status_service import ConnectionStatusService

JSM_DB = "app.modules.internal_api.repositories.jsm_credentials_repository.get_db"
JSM_CIPHER = "app.modules.internal_api.repositories.jsm_credentials_repository.SecretCipher"
CONFLUENCE_DB = "app.modules.internal_api.repositories.confluence_credentials_repository.get_db"
CONFLUENCE_CIPHER = "app.modules.internal_api.repositories.confluence_credentials_repository.SecretCipher"
ROUTER_SERVICE = "app.modules.internal_api.router._connection_status_service"

app = FastAPI()
app.include_router(router)
client = TestClient(app)


# arma una fila simulada de system_config
def _config_row(key, value):
    row = MagicMock()
    row.key = key
    row.encrypted_value = value
    return row


# verifica que con la conexion de jsm completa devuelve la url y el email, y que el token no se desencripta
@patch(JSM_CIPHER)
@patch(JSM_DB)
def test_jsm_public_settings_returns_url_and_email_without_decrypting_the_token(mock_get_db, mock_cipher_class):
    mock_cipher_class.return_value.decrypt.side_effect = lambda value: f"dec:{value}"
    mock_db = MagicMock()
    mock_get_db.return_value = iter([mock_db])
    mock_db.execute.return_value.fetchall.return_value = [
        _config_row("jsm_base_url", "enc-url"),
        _config_row("jsm_user_email", "enc-mail"),
        _config_row("jsm_api_token", "enc-token"),
    ]

    result = JsmCredentialsRepository().get_public_settings()

    assert result == {"base_url": "dec:enc-url", "user_email": "dec:enc-mail"}
    decrypted = [call[0][0] for call in mock_cipher_class.return_value.decrypt.call_args_list]
    assert "enc-token" not in decrypted


# verifica que si falta el token de jsm la conexion se considera sin configurar
@patch(JSM_CIPHER)
@patch(JSM_DB)
def test_jsm_public_settings_returns_none_when_the_token_is_missing(mock_get_db, mock_cipher_class):
    mock_db = MagicMock()
    mock_get_db.return_value = iter([mock_db])
    mock_db.execute.return_value.fetchall.return_value = [
        _config_row("jsm_base_url", "enc-url"),
        _config_row("jsm_user_email", "enc-mail"),
    ]

    assert JsmCredentialsRepository().get_public_settings() is None


# verifica que sin ninguna fila guardada la conexion de jsm se considera sin configurar
@patch(JSM_CIPHER)
@patch(JSM_DB)
def test_jsm_public_settings_returns_none_when_nothing_is_saved(mock_get_db, mock_cipher_class):
    mock_db = MagicMock()
    mock_get_db.return_value = iter([mock_db])
    mock_db.execute.return_value.fetchall.return_value = []

    assert JsmCredentialsRepository().get_public_settings() is None


# verifica que con la conexion de confluence completa devuelve la url y el email, y que el token no se desencripta
@patch(CONFLUENCE_CIPHER)
@patch(CONFLUENCE_DB)
def test_confluence_public_settings_returns_url_and_email_without_decrypting_the_token(mock_get_db, mock_cipher_class):
    mock_cipher_class.return_value.decrypt.side_effect = lambda value: f"dec:{value}"
    mock_db = MagicMock()
    mock_get_db.return_value = iter([mock_db])
    mock_db.execute.return_value.fetchall.return_value = [
        _config_row("confluence_base_url", "enc-url"),
        _config_row("confluence_user_email", "enc-mail"),
        _config_row("confluence_api_token", "enc-token"),
    ]

    result = ConfluenceCredentialsRepository().get_public_settings()

    assert result == {"base_url": "dec:enc-url", "user_email": "dec:enc-mail"}
    decrypted = [call[0][0] for call in mock_cipher_class.return_value.decrypt.call_args_list]
    assert "enc-token" not in decrypted


# verifica que si falta el token de confluence la conexion se considera sin configurar
@patch(CONFLUENCE_CIPHER)
@patch(CONFLUENCE_DB)
def test_confluence_public_settings_returns_none_when_the_token_is_missing(mock_get_db, mock_cipher_class):
    mock_db = MagicMock()
    mock_get_db.return_value = iter([mock_db])
    mock_db.execute.return_value.fetchall.return_value = [_config_row("confluence_base_url", "enc-url")]

    assert ConfluenceCredentialsRepository().get_public_settings() is None


# verifica que sin configuracion el servicio informa configured en false y deja la url y el email en null
def test_service_reports_not_configured_when_there_are_no_settings():
    service = ConnectionStatusService.__new__(ConnectionStatusService)
    service.jsm_credentials_repository = MagicMock()
    service.jsm_credentials_repository.get_public_settings.return_value = None

    assert service.get_jsm_connection() == {"configured": False, "base_url": None, "user_email": None}


# verifica que con configuracion el servicio informa configured en true con la url y el email
def test_service_reports_configured_with_url_and_email():
    service = ConnectionStatusService.__new__(ConnectionStatusService)
    service.confluence_credentials_repository = MagicMock()
    service.confluence_credentials_repository.get_public_settings.return_value = {
        "base_url": "https://example.atlassian.net/wiki", "user_email": "test@example.com"
    }

    assert service.get_confluence_connection() == {
        "configured": True, "base_url": "https://example.atlassian.net/wiki", "user_email": "test@example.com"
    }


# verifica que el endpoint de jsm devuelve 200 con exactamente tres campos, sin ningun secreto
@patch(ROUTER_SERVICE)
def test_get_itsm_connection_returns_only_the_public_fields(mock_service):
    mock_service.get_jsm_connection.return_value = {"configured": True, "base_url": "https://example.atlassian.net", "user_email": "test@example.com"}

    app.dependency_overrides[require_admin] = lambda: MagicMock(id="admin-1", role="admin")

    response = client.get("/api/config/itsm")

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert set(response.json()) == {"configured", "base_url", "user_email"}
    assert response.json()["configured"] is True


# verifica que el endpoint de confluence devuelve 200 con configured en false cuando todavia no hay conexion
@patch(ROUTER_SERVICE)
def test_get_confluence_connection_when_not_configured(mock_service):
    mock_service.get_confluence_connection.return_value = {"configured": False, "base_url": None, "user_email": None}

    app.dependency_overrides[require_admin] = lambda: MagicMock(id="admin-1", role="admin")

    response = client.get("/api/config/knowledge-base")

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == {"configured": False, "base_url": None, "user_email": None}


# verifica que un error inesperado se traduce en HTTP 503
@patch(ROUTER_SERVICE)
def test_get_itsm_connection_unexpected_error_returns_503(mock_service):
    mock_service.get_jsm_connection.side_effect = Exception("falla de bd")

    app.dependency_overrides[require_admin] = lambda: MagicMock(id="admin-1", role="admin")

    response = client.get("/api/config/itsm")

    app.dependency_overrides.clear()

    assert response.status_code == 503
