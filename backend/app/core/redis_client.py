"""
Cliente Redis compartido para todo el backend.
Se usa una unica conexion reutilizada por M1, worker y M2 cuando recupea el historial
"""

import redis.asyncio as redis
from app.core.config import settings

# instancia única de la conexión a redis
_redis_client = redis.from_url(settings.redis_url, decode_responses=True)

#devuelve la conexión compartida a redis
def get_redis() -> redis.Redis:
  
    return _redis_client