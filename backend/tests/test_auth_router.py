"""Tests de integracion para el router de auth  uandoo TestClient
Se mockea _auth_service, sin tocar bcrypt, JWT, Redis ni Supabase reales"""

from unittest.mock import patch, AsyncMock, MagicMock
from fastapi.testclient import TestClient
from fastapi import FastAPI
from app.modules.auth.router import router
from app.modules.auth.dependencies import get_current_user, require_admin
from app.modules.auth.schemas import AppUser

app = FastAPI()
app.include_router(router)
client = TestClient(app)


# verifica que login exitoso devuelve 200 con token y role
@patch("app.modules.auth.router._auth_service")
def test_login_success(mock_auth_service):
    mock_auth_service.login.return_value = {"access_token": "token-de-prueba", "role": "admin"}

    response = client.post("/auth/login", json={"email": "test@tokenia.com", "password": "Test1234!"})

    assert response.status_code == 200
    assert response.json()["access_token"] == "token-de-prueba"
    assert response.json()["role"] == "admin"


# verifica que credenciales invalidas devuelven 401
@patch("app.modules.auth.router._auth_service")
def test_login_invalid_credentials(mock_auth_service):
    mock_auth_service.login.side_effect = ValueError("credenciales invalidas")

    response = client.post("/auth/login", json={"email": "test@tokenia.com", "password": "ContraseñaMala"})

    assert response.status_code == 401


# verifica que una password mas larga que 72 caracteres es rechazada por pydantic, sin llegar al service
def test_login_password_too_long():
    response = client.post("/auth/login", json={"email": "test@tokenia.com", "password": "x" * 73})

    assert response.status_code == 422


# verifica que logout exitoso devuelve 200
# get_current_user se reemplaza con app.dependency_overrides, no con @patch, porque Depends()
# ya quedo atado al objeto funcion real cuando el router se importo, @patch sobre el nombre no alcanza
@patch("app.modules.auth.router.decode_token")
@patch("app.modules.auth.router._auth_service")
def test_logout_success(mock_auth_service, mock_decode_token):
    mock_decode_token.return_value = {"jti": "jti-1", "exp": 1790520478}
    mock_auth_service.logout = AsyncMock(return_value=None)

    app.dependency_overrides[get_current_user] = lambda: MagicMock(id="user-1", role="admin")

    response = client.post("/auth/logout", headers={"Authorization": "Bearer token-de-prueba"})

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


# verifica que admin puede listar usuarios
@patch("app.modules.auth.router.require_admin")
@patch("app.modules.auth.router._user_management_service")
def test_list_users_as_admin(mock_service, mock_require_admin):
    mock_service.list_users.return_value = [
        AppUser(
            id="user-1", email="admin@tokenia.com", password_hash="$2b$12$x",
            full_name="Admin", role="admin", is_active=True,
            created_at="2026-09-26T00:00:00Z", updated_at="2026-09-26T00:00:00Z",
        )
    ]

    app.dependency_overrides[require_admin] = lambda: MagicMock(id="admin-1", role="admin")

    response = client.get("/api/users")

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert len(response.json()["users"]) == 1
    assert "password_hash" not in response.json()["users"][0]


# verifica que crear un usuario devuelve 201 con los datos publicos
@patch("app.modules.auth.router.require_admin")
@patch("app.modules.auth.router._user_management_service")
def test_create_user_success(mock_service, mock_require_admin):
    mock_service.create_user.return_value = AppUser(
        id="user-2", email="nuevo@tokenia.com", password_hash="$2b$12$x",
        full_name="Usuario Nuevo", role="agent", is_active=True,
        created_at="2026-09-26T00:00:00Z", updated_at="2026-09-26T00:00:00Z",
    )

    app.dependency_overrides[require_admin] = lambda: MagicMock(id="admin-1", role="admin")

    response = client.post("/api/users", json={
        "email": "nuevo@tokenia.com", "password": "Password123!",
        "full_name": "Usuario Nuevo", "role": "agent",
    })

    app.dependency_overrides.clear()

    assert response.status_code == 201
    assert response.json()["email"] == "nuevo@tokenia.com"


# verifica que email duplicado devuelve 409
@patch("app.modules.auth.router.require_admin")
@patch("app.modules.auth.router._user_management_service")
def test_create_user_duplicate_email(mock_service, mock_require_admin):
    mock_service.create_user.side_effect = ValueError("el email ya esta registrado")

    app.dependency_overrides[require_admin] = lambda: MagicMock(id="admin-1", role="admin")

    response = client.post("/api/users", json={
        "email": "existente@tokenia.com", "password": "Password123!",
        "full_name": "Usuario", "role": "agent",
    })

    app.dependency_overrides.clear()

    assert response.status_code == 409


# verifica que un role invalido es rechazado por pydantic antes de llegar al service
@patch("app.modules.auth.router.require_admin")
def test_create_user_invalid_role(mock_require_admin):
    app.dependency_overrides[require_admin] = lambda: MagicMock(id="admin-1", role="admin")

    response = client.post("/api/users", json={
        "email": "nuevo@tokenia.com", "password": "Password123!",
        "full_name": "Usuario", "role": "superadmin",
    })

    app.dependency_overrides.clear()

    assert response.status_code == 422


# verifica que una password de menos de 8 caracteres es rechazada por pydantic
@patch("app.modules.auth.router.require_admin")
def test_create_user_password_too_short(mock_require_admin):
    app.dependency_overrides[require_admin] = lambda: MagicMock(id="admin-1", role="admin")

    response = client.post("/api/users", json={
        "email": "nuevo@tokenia.com", "password": "corta",
        "full_name": "Usuario", "role": "agent",
    })

    app.dependency_overrides.clear()

    assert response.status_code == 422

# verifica que un admin puede editar a otro usuario
@patch("app.modules.auth.router.require_admin")
@patch("app.modules.auth.router._user_management_service")
def test_update_user_success(mock_service, mock_require_admin):
    mock_service.update_user.return_value = AppUser(
        id="user-1", email="editado@tokenia.com", password_hash="$2b$12$x",
        full_name="Nombre Editado", role="agent", is_active=True,
        created_at="2026-09-26T00:00:00Z", updated_at="2026-09-26T00:00:00Z",
    )

    app.dependency_overrides[require_admin] = lambda: MagicMock(id="admin-1", role="admin")

    response = client.put("/api/users/user-1", json={"full_name": "Nombre Editado", "role": "agent"})

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["full_name"] == "Nombre Editado"


# verifica que editar un id inexistente devuelve 404
@patch("app.modules.auth.router.require_admin")
@patch("app.modules.auth.router._user_management_service")
def test_update_user_not_found(mock_service, mock_require_admin):
    mock_service.update_user.side_effect = ValueError("usuario no encontrado")

    app.dependency_overrides[require_admin] = lambda: MagicMock(id="admin-1", role="admin")

    response = client.put("/api/users/id-inexistente", json={"full_name": "Nombre", "role": "agent"})

    app.dependency_overrides.clear()

    assert response.status_code == 404


# verifica que un role invalido es rechazado por pydantic
@patch("app.modules.auth.router.require_admin")
def test_update_user_invalid_role(mock_require_admin):
    app.dependency_overrides[require_admin] = lambda: MagicMock(id="admin-1", role="admin")

    response = client.put("/api/users/user-1", json={"full_name": "Nombre", "role": "superadmin"})

    app.dependency_overrides.clear()

    assert response.status_code == 422

# verifica que un admin puede desactivar a otro usuario
@patch("app.modules.auth.router.require_admin")
@patch("app.modules.auth.router._user_management_service")
def test_deactivate_user_success(mock_service, mock_require_admin):
    mock_service.deactivate_user.return_value = AppUser(
        id="user-1", email="desactivado@tokenia.com", password_hash="$2b$12$x",
        full_name="Usuario Desactivado", role="agent", is_active=False,
        created_at="2026-09-26T00:00:00Z", updated_at="2026-09-26T00:00:00Z",
    )

    app.dependency_overrides[require_admin] = lambda: MagicMock(id="admin-1", role="admin")

    response = client.patch("/api/users/user-1/deactivate")

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["is_active"] is False


# verifica que autodesactivarse devuelve 400
@patch("app.modules.auth.router.require_admin")
@patch("app.modules.auth.router._user_management_service")
def test_deactivate_user_self_rejected(mock_service, mock_require_admin):
    mock_service.deactivate_user.side_effect = PermissionError("no podes desactivarte a vos mismo")

    app.dependency_overrides[require_admin] = lambda: MagicMock(id="admin-1", role="admin")

    response = client.patch("/api/users/admin-1/deactivate")

    app.dependency_overrides.clear()

    assert response.status_code == 400


# verifica que un id inexistente devuelve 404
@patch("app.modules.auth.router.require_admin")
@patch("app.modules.auth.router._user_management_service")
def test_deactivate_user_not_found(mock_service, mock_require_admin):
    mock_service.deactivate_user.side_effect = ValueError("usuario no encontrado")

    app.dependency_overrides[require_admin] = lambda: MagicMock(id="admin-1", role="admin")

    response = client.patch("/api/users/id-inexistente/deactivate")

    app.dependency_overrides.clear()

    assert response.status_code == 404