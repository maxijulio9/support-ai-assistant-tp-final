# M9 AuthModule: denylist de tokens invalidados en Redis
# add_to_denylist se agrega en TF-77, cuando exista el logout que lo necesita

from datetime import datetime, timezone
from app.core.redis_client import get_redis

# chequea si un jti fue invalidado por logout
async def is_denylisted(jti: str) -> bool:
    redis = get_redis()
    existe = await redis.exists(f"jwt_denylist:{jti}")
    return existe > 0


# agrega un jti a la denylist, con TTL igual al tiempo que le queda de vida al token
# si el token ya esta vencido no hace falta denylistearlo, decode_token ya lo va a rechazar solo
async def add_to_denylist(jti: str, exp: int) -> None:
    ahora = int(datetime.now(timezone.utc).timestamp())
    ttl_restante = exp - ahora

    if ttl_restante <= 0:
        return

    redis = get_redis()
    await redis.set(f"jwt_denylist:{jti}", "1", ex=ttl_restante)