# M9 AuthModule
# dependencia de FastAPI para proteger endpoints con JWT

from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.modules.auth.jwt_handler import decode_token
from app.modules.auth.token_denylist import is_denylisted
from app.modules.auth.repositories.app_user_repository import AppUserRepository
from app.modules.auth.schemas import AppUser

_bearer_scheme = HTTPBearer()
_app_user_repository = AppUserRepository()


# valida el token, la denylist y el usuario, en ese orden
# cualquier fallo en cualquiera de los tres pasos termina en 401, mismo criterio de mensaje generico que login
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme)) -> AppUser:
    token = credentials.credentials

    try:
        payload = decode_token(token)
    except ValueError:
        raise HTTPException(status_code=401, detail="Credenciales invalidas")

    if await is_denylisted(payload["jti"]):
        raise HTTPException(status_code=401, detail="Credenciales invalidas")

    user = _app_user_repository.get_by_id(payload["sub"])

    if user is None or not user.is_active:
        raise HTTPException(status_code=401, detail="Credenciales invalidas")

    return user