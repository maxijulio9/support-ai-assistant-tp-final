# M9 AuthModule: endpoint de login

from fastapi import APIRouter, HTTPException, Depends
from app.modules.auth.schemas import LoginRequest, LoginResponse
from app.modules.auth.services.auth_service import AuthService
from app.modules.auth.dependencies import get_current_user, _bearer_scheme
from fastapi.security import HTTPAuthorizationCredentials
from app.modules.auth.jwt_handler import decode_token
from app.modules.auth.schemas import AppUser

router = APIRouter(tags=["Auth"])

_auth_service = AuthService()


@router.post("/auth/login", response_model=LoginResponse)
def login(request: LoginRequest):
    try:
        result = _auth_service.login(request.email, request.password)
    except ValueError:
        raise HTTPException(status_code=401, detail="Credenciales invalidas")

    return LoginResponse(access_token=result["access_token"], role=result["role"])


@router.post("/auth/logout")
async def logout(
    usuario: AppUser = Depends(get_current_user),
    credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme),
):
    payload = decode_token(credentials.credentials)
    await _auth_service.logout(payload["jti"], payload["exp"])

    return {"status": "ok"}