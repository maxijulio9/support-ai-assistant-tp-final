# M9 AuthModule: endpoints de login, logout y gestion de usuarios

from fastapi import APIRouter, HTTPException, Depends
from fastapi.concurrency import run_in_threadpool
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
    ForgotPasswordRequest,
    ResetPasswordRequest,
)
from app.modules.auth.services.auth_service import AuthService
from app.modules.auth.services.user_management_service import UserManagementService
from app.modules.auth.dependencies import get_current_user, require_admin, _bearer_scheme
from app.modules.auth.jwt_handler import decode_token
from app.core.config import settings
from app.modules.auth import rate_limiter


router = APIRouter(tags=["Auth"])

_auth_service = AuthService()
_user_management_service = UserManagementService()



@router.post(
    "/auth/login",
    response_model=LoginResponse,
    responses={429: {"description": "Demasiados intentos fallidos con ese correo, se desbloquea solo pasado un rato"}},
)
def login(request: LoginRequest):
    # despues de varios intentos fallidos seguidos con el mismo correo se cortan los pedidos un rato
    rate_limiter.ensure_allowed("login", request.email, settings.login_max_attempts)

    try:
        result = _auth_service.login(request.email, request.password)
    except ValueError:
        rate_limiter.record_failure("login", request.email, settings.login_window_seconds)
        raise HTTPException(status_code=401, detail="Credenciales invalidas")

    rate_limiter.reset("login", request.email)

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

@router.patch("/api/users/{user_id}/activate", response_model=UserResponse)
def activate_user(user_id: str, admin: AppUser = Depends(require_admin)):
    try:
        usuario = _user_management_service.activate_user(user_id)
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

@router.post(
    "/auth/forgot-password",
    responses={429: {"description": "Demasiados pedidos de restablecimiento, se habilita de nuevo pasado un rato"}},
)
async def forgot_password(request: ForgotPasswordRequest):
    # cada pedido cuenta aunque el correo no exista, para no revelar que cuentas existen
    # primero el tope por correo y despues el tope general, que cuida la cuota del servicio de mails
    await run_in_threadpool(
        rate_limiter.hit, "forgot-email", request.email, settings.forgot_password_max_per_email, settings.forgot_password_window_seconds
    )
    await run_in_threadpool(
        rate_limiter.hit, "forgot-global", "todos", settings.forgot_password_max_global, settings.forgot_password_window_seconds
    )

    await _auth_service.forgot_password(request.email)
    return {"status": "ok"}


@router.post("/auth/reset-password")
async def reset_password(request: ResetPasswordRequest):
    try:
        await _auth_service.reset_password(request.token, request.new_password)
    except ValueError:
        raise HTTPException(status_code=400, detail="Token invalido o vencido")

    return {"status": "ok"}