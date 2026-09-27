# M9 AuthModule: endpoint de login

from fastapi import APIRouter, HTTPException
from app.modules.auth.schemas import LoginRequest, LoginResponse
from app.modules.auth.services.auth_service import AuthService

router = APIRouter(tags=["Auth"])

_auth_service = AuthService()


@router.post("/auth/login", response_model=LoginResponse)
def login(request: LoginRequest):
    try:
        result = _auth_service.login(request.email, request.password)
    except ValueError:
        raise HTTPException(status_code=401, detail="Credenciales invalidas")

    return LoginResponse(access_token=result["access_token"], role=result["role"])