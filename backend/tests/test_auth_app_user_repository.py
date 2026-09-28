"""Tests unitarios para AppUserRepository de M9
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


# verifica que list_all devuelve una lista de AppUser a partir de varias filas
@patch("app.modules.auth.repositories.app_user_repository.get_db")
def test_list_all_returns_all_users(mock_get_db):
    mock_db = MagicMock()
    mock_get_db.return_value = iter([mock_db])
    mock_db.execute.return_value.fetchall.return_value = [
        _build_app_user_row(id="user-1", email="admin@tokenia.com", role="admin"),
        _build_app_user_row(id="user-2", email="agent@tokenia.com", role="agent"),
    ]

    repo = AppUserRepository()
    result = repo.list_all()

    assert len(result) == 2
    assert result[0].email == "admin@tokenia.com"
    assert result[1].role == "agent"


# verifica que create inserta y devuelve el AppUser creado, con commit
@patch("app.modules.auth.repositories.app_user_repository.get_db")
def test_create_inserts_and_returns_user(mock_get_db):
    mock_db = MagicMock()
    mock_get_db.return_value = iter([mock_db])
    mock_db.execute.return_value.fetchone.return_value = _build_app_user_row(
        email="nuevo@tokenia.com", role="agent"
    )

    repo = AppUserRepository()
    result = repo.create("nuevo@tokenia.com", "$2b$12$hasheado", "Usuario Nuevo", "agent")

    assert result.email == "nuevo@tokenia.com"
    assert result.role == "agent"
    mock_db.commit.assert_called_once()


# verifica que create hace rollback si la insercion falla
@patch("app.modules.auth.repositories.app_user_repository.get_db")
def test_create_rolls_back_on_error(mock_get_db):
    mock_db = MagicMock()
    mock_db.execute.side_effect = Exception("email duplicado")
    mock_get_db.return_value = iter([mock_db])

    repo = AppUserRepository()

    try:
        repo.create("duplicado@tokenia.com", "$2b$12$hasheado", "Usuario", "agent")
        assert False, "deberia haber lanzado una excepcion"
    except Exception:
        pass

    mock_db.rollback.assert_called_once()