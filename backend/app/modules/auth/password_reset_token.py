# M9 AuthModule
# tokens de un solo uso para el flujo de restablecimiento de contraseña
# se guardan en Redis con TTL, el token en si funciona como clave (opaco, no es un JWT)

import secrets
from app.core.redis_client import get_redis

TTL_SEGUNDOS = 30 * 60  # 30 minutos


# genera un token random y lo guarda en Redis apuntando al id del usuario
async def create_reset_token(user_id: str) -> str:
    token = secrets.token_urlsafe(32)
    redis = get_redis()
    await redis.set(f"password_reset:{token}", user_id, ex=TTL_SEGUNDOS)
    return token


# busca el id del usuario asociado a un token, None si no existe o vencio
async def get_user_id_from_token(token: str) -> str | None:
    redis = get_redis()
    return await redis.get(f"password_reset:{token}")


# elimina el token despues de usarlo, para que no se pueda reusarss
async def consume_reset_token(token: str) -> None:
    redis = get_redis()
    await redis.delete(f"password_reset:{token}")