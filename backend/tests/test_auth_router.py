"""Tests de integracion para el router de auth  uandoo TestClient
Se mockea _auth_service, sin tocar bcrypt, JWT, Redis ni Supabase reales"""

from unittest.mock import patch, AsyncMock, MagicMock
from fastapi.testclient import TestClient
from fastapi import FastAPI
from app.modules.auth.router import router
from app.modules.auth.dependencies import get_current_user

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