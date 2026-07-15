# pool de conexion para encolar tareas en arq desde m1
# es distinto del cliente redis normal porque arq necesita su propio formato de conexion

from arq import create_pool
from arq.connections import RedisSettings
from app.core.config import settings

_pool = None


#crea el pool una sola vez y lo reutiliza en las siguientes llamadas

async def get_arq_pool():
    global _pool
    if _pool is None:
        _pool = await create_pool(RedisSettings.from_dsn(settings.redis_url))
    return _pool