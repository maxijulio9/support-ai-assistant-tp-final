"""Tests unitarios para bootstrap_admin 
Se mockea settings, el repositorio y el hasher, sin tocar la bd real."""

from unittest.mock import patch, MagicMock
from app.modules.auth.bootstrap import bootstrap_admin


# verifica que crea el admin cuando la tabla esta vacia y las variables estan seteadas
@patch("app.modules.auth.bootstrap.AppUserRepository")
@patch("app.modules.auth.bootstrap.settings")
def test_bootstrap_creates_admin_when_empty(mock_settings, mock_repository_class):
    mock_settings.admin_email = "admin@tokenia.com"
    mock_settings.admin_password = "ClaveSegura123!"
    mock_repository_class.return_value.count_users.return_value = 0

    bootstrap_admin()

    mock_repository_class.return_value.create.assert_called_once()
    args = mock_repository_class.return_value.create.call_args[0]
    assert args[0] == "admin@tokenia.com"


# verifica que no hace nada si ya hay usuarios, aunque las variables esten seteadas
@patch("app.modules.auth.bootstrap.AppUserRepository")
@patch("app.modules.auth.bootstrap.settings")
def test_bootstrap_does_nothing_when_users_exist(mock_settings, mock_repository_class):
    mock_settings.admin_email = "admin@tokenia.com"
    mock_settings.admin_password = "ClaveSegura123!"
    mock_repository_class.return_value.count_users.return_value = 1

    bootstrap_admin()

    mock_repository_class.return_value.create.assert_not_called()


# verifica que no hace nada si las variables de entorno no estan seteadas, aunque la tabla este vacia
@patch("app.modules.auth.bootstrap.AppUserRepository")
@patch("app.modules.auth.bootstrap.settings")
def test_bootstrap_does_nothing_when_env_vars_missing(mock_settings, mock_repository_class):
    mock_settings.admin_email = ""
    mock_settings.admin_password = ""

    bootstrap_admin()

    mock_repository_class.return_value.count_users.assert_not_called()
    mock_repository_class.return_value.create.assert_not_called()