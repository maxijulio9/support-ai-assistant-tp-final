"""Tests de integracion para get_current_user (M9), via una ruta de prueba real con TestClient.
Se prueba a traves del ciclo completo de FastAPI (headers, Depends, HTTPException),
no llamando a la corutina directo. Se mockea decode_token, is_denylisted y el repositorio,
sin tocar Redis ni Supabase reales."""
import pytest
from unittest.mock import patch, AsyncMock
from fastapi import FastAPI, Depends
from fastapi.testclient import TestClient
from app.modules.auth.dependencies import get_current_user, require_admin
from app.modules.auth.schemas import AppUser

app = FastAPI()

@app.get("/admin-de-prueba")
async def ruta_admin(usuario: AppUser = Depends(require_admin)):
    return {"email": usuario.email, "role": usuario.role}

@app.get("/proteccion-de-prueba")
async def ruta_protegida(usuario: AppUser = Depends(get_current_user)):
    return {"email": usuario.email, "role": usuario.role}


client = TestClient(app)


def _build_app_user(**overrides):
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
    return AppUser(**defaults)


# verifica que sin header Authorization, HTTPBearer rechaza antes de llegar a nuestra logica
def test_ruta_protegida_sin_token():
    response = client.get("/proteccion-de-prueba")

    assert response.status_code == 403


# verifica que con token invalido, la ruta devuelve 401 con el mensaje generico
@patch("app.modules.auth.dependencies.decode_token")
def test_ruta_protegida_token_invalido(mock_decode_token):
    mock_decode_token.side_effect = ValueError("token invalido")

    response = client.get("/proteccion-de-prueba", headers={"Authorization": "Bearer token-falso"})

    assert response.status_code == 401
    assert response.json()["detail"] == "Credenciales invalidas"


# verifica que con token denylisteado, la ruta devuelve 401
@patch("app.modules.auth.dependencies.is_denylisted", new_callable=AsyncMock)
@patch("app.modules.auth.dependencies.decode_token")
def test_ruta_protegida_token_denylisteado(mock_decode_token, mock_is_denylisted):
    mock_decode_token.return_value = {"sub": "user-1", "jti": "jti-1"}
    mock_is_denylisted.return_value = True

    response = client.get("/proteccion-de-prueba", headers={"Authorization": "Bearer token-valido"})

    assert response.status_code == 401


# verifica que con usuario inactivo, la ruta devuelve 401 aunque el token sea valido
@patch("app.modules.auth.dependencies._app_user_repository")
@patch("app.modules.auth.dependencies.is_denylisted", new_callable=AsyncMock)
@patch("app.modules.auth.dependencies.decode_token")
def test_ruta_protegida_usuario_inactivo(mock_decode_token, mock_is_denylisted, mock_repository):
    mock_decode_token.return_value = {"sub": "user-1", "jti": "jti-1"}
    mock_is_denylisted.return_value = False
    mock_repository.get_by_id.return_value = _build_app_user(is_active=False)

    response = client.get("/proteccion-de-prueba", headers={"Authorization": "Bearer token-valido"})

    assert response.status_code == 401


# verifica que con todo valido, la ruta devuelve 200 con los datos del usuario
@patch("app.modules.auth.dependencies._app_user_repository")
@patch("app.modules.auth.dependencies.is_denylisted", new_callable=AsyncMock)
@patch("app.modules.auth.dependencies.decode_token")
def test_ruta_protegida_success(mock_decode_token, mock_is_denylisted, mock_repository):
    mock_decode_token.return_value = {"sub": "user-1", "jti": "jti-1"}
    mock_is_denylisted.return_value = False
    mock_repository.get_by_id.return_value = _build_app_user()

    response = client.get("/proteccion-de-prueba", headers={"Authorization": "Bearer token-valido"})

    assert response.status_code == 200
    assert response.json()["email"] == "test@tokenia.com"
    assert response.json()["role"] == "admin"
    
    
# verifica que un admin puede acceder a una ruta que requiere rol admin
@patch("app.modules.auth.dependencies._app_user_repository")
@patch("app.modules.auth.dependencies.is_denylisted", new_callable=AsyncMock)
@patch("app.modules.auth.dependencies.decode_token")
def test_ruta_admin_permite_admin(mock_decode_token, mock_is_denylisted, mock_repository):
    mock_decode_token.return_value = {"sub": "user-1", "jti": "jti-1"}
    mock_is_denylisted.return_value = False
    mock_repository.get_by_id.return_value = _build_app_user(role="admin")

    response = client.get("/admin-de-prueba", headers={"Authorization": "Bearer token-valido"})

    assert response.status_code == 200
    assert response.json()["role"] == "admin"


# verifica que un agent recibe 403 al intentar acceder a una ruta que requiere rol admin
@patch("app.modules.auth.dependencies._app_user_repository")
@patch("app.modules.auth.dependencies.is_denylisted", new_callable=AsyncMock)
@patch("app.modules.auth.dependencies.decode_token")
def test_ruta_admin_rechaza_agent(mock_decode_token, mock_is_denylisted, mock_repository):
    mock_decode_token.return_value = {"sub": "user-1", "jti": "jti-1"}
    mock_is_denylisted.return_value = False
    mock_repository.get_by_id.return_value = _build_app_user(role="agent")

    response = client.get("/admin-de-prueba", headers={"Authorization": "Bearer token-valido"})

    assert response.status_code == 403
