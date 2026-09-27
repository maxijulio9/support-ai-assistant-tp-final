# M9 AuthModule: generacion de JWT para el login
#

import uuid
from datetime import datetime, timedelta, timezone

import jwt

from app.core.config import settings


# genera el jwt que se entrega en el login
# incluye jti para poder invalidar el token puntual en logout (TF-77)
def create_access_token(user_id: str, role: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "role": role,
        "jti": str(uuid.uuid4()),
        "iat": now,
        "exp": now + timedelta(minutes=settings.jwt_expiration_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm="HS256")


# valida firma y expiracion, devuelve el payload decodificado
# mismo criterio de error que AuthService.login, ValueError generico para no filtrar el motivo exacto
def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.jwt_secret_key, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise ValueError("token invalido")
    except jwt.InvalidTokenError:
        raise ValueError("token invalido")