# M9 AuthModule: denylist de tokens invalidados en Redis
# add_to_denylist se agrega en TF-77, cuando exista el logout que lo necesita

from app.core.redis_client import get_redis


# chequea si un jti fue invalidado por logout
async def is_denylisted(jti: str) -> bool:
    redis = get_redis()
    existe = await redis.exists(f"jwt_denylist:{jti}")
    return existe > 0