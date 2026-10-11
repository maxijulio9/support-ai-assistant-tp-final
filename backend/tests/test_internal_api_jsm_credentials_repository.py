"""Tests unitarios para JsmCredentialsRepository.get_base_url.
Se mockean get_db y SecretCipher para no depender de la bd ni de la clave real."""

from unittest.mock import patch, MagicMock
from app.modules.internal_api.repositories.jsm_credentials_repository import JsmCredentialsRepository


# verifica que devuelve la url base descifrada cuando esta guardada
@patch("app.modules.internal_api.repositories.jsm_credentials_repository.SecretCipher")
@patch("app.modules.internal_api.repositories.jsm_credentials_repository.get_db")
def test_get_base_url_returns_decrypted_value(mock_get_db, mock_cipher_class):
    mock_db = MagicMock()
    mock_db.execute.return_value.fetchone.return_value = MagicMock(encrypted_value="valor-cifrado")
    mock_get_db.return_value = iter([mock_db])
    mock_cipher_class.return_value.decrypt.return_value = "https://example.atlassian.net"

    result = JsmCredentialsRepository().get_base_url()

    assert result == "https://example.atlassian.net"
    mock_cipher_class.return_value.decrypt.assert_called_once_with("valor-cifrado")


# verifica que devuelve none y no intenta descifrar cuando todavia no se configuro la conexion
@patch("app.modules.internal_api.repositories.jsm_credentials_repository.SecretCipher")
@patch("app.modules.internal_api.repositories.jsm_credentials_repository.get_db")
def test_get_base_url_returns_none_when_not_configured(mock_get_db, mock_cipher_class):
    mock_db = MagicMock()
    mock_db.execute.return_value.fetchone.return_value = None
    mock_get_db.return_value = iter([mock_db])

    result = JsmCredentialsRepository().get_base_url()

    assert result is None
    mock_cipher_class.return_value.decrypt.assert_not_called()