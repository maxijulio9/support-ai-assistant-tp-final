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
    UpdateUserRequest,
    UpdateProfileRequest,
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



@router.put("/api/users/{user_id}", response_model=UserResponse)
def update_user(user_id: str, request: UpdateUserRequest, admin: AppUser = Depends(require_admin)):
    try:
        usuario = _user_management_service.update_user(user_id, request.full_name, request.role)
    except ValueError:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    return UserResponse(**usuario.model_dump())


@router.patch("/api/users/{user_id}/deactivate", response_model=UserResponse)
def deactivate_user(user_id: str, admin: AppUser = Depends(require_admin)):
    try:
        usuario = _user_management_service.deactivate_user(user_id, admin.id)
    except PermissionError:
        raise HTTPException(status_code=400, detail="No podes desactivarte a vos mismo")
    except ValueError:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    return UserResponse(**usuario.model_dump())

@router.get("/auth/profile", response_model=UserResponse)
def get_profile(usuario: AppUser = Depends(get_current_user)):
    return UserResponse(**usuario.model_dump())


@router.put("/auth/profile", response_model=UserResponse)
def update_profile(request: UpdateProfileRequest, usuario: AppUser = Depends(get_current_user)):
    actualizado = _user_management_service.update_profile(usuario.id, request.full_name, usuario.role)
    return UserResponse(**actualizado.model_dump())