# M9 AuthModule: endpoints de login, logout y gestion de usuarios

from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPAuthorizationCredentials
from app.modules.auth.schemas import (
    LoginRequest,
    LoginResponse,
    AppUser,
    CreateUserRequest,
    UserResponse,
    UserListResponse,
)
from app.modules.auth.services.auth_service import AuthService
from app.modules.auth.services.user_management_service import UserManagementService
from app.modules.auth.dependencies import get_current_user, require_admin, _bearer_scheme
from app.modules.auth.jwt_handler import decode_token


router = APIRouter(tags=["Auth"])

_auth_service = AuthService()
_user_management_service = UserManagementService()



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


@router.get("/api/users", response_model=UserListResponse)
def list_users(admin: AppUser = Depends(require_admin)):
    usuarios = _user_management_service.list_users()
    return UserListResponse(users=[UserResponse(**usuario.model_dump()) for usuario in usuarios])


@router.post("/api/users", response_model=UserResponse, status_code=201)
def create_user(request: CreateUserRequest, admin: AppUser = Depends(require_admin)):
    try:
        usuario = _user_management_service.create_user(
            request.email, request.password, request.full_name, request.role
        )
    except ValueError:
        raise HTTPException(status_code=409, detail="El email ya esta registrado")

    return UserResponse(**usuario.model_dump())