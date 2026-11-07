# M9 AuthModule: limite de intentos con contadores en redis
# se cuenta por correo y no por ip, detras del proxy del frontend todos los pedidos llegan con la misma ip
# si redis no responde el pedido pasa igual, el limite es una proteccion extra y no puede tirar el login ni el restablecimiento
# tras un error de redis se deja de consultar un rato para no sumar espera a cada pedidoo

import logging
import time

import redis
from fastapi import HTTPException

from app.core.config import settings

logger = logging.getLogger(__name__)

# segundos que se omite el limite despues de un error de conexion con redis
REDIS_RETRY_SECONDS = 30

_client = None
_unavailable_until = 0.0


# cliente de redis compartido por todos los pedidos, se crea la primera vez que se usa
def _get_client():
    global _client

    if _client is None:
        _client = redis.Redis.from_url(settings.redis_url, decode_responses=True, socket_timeout=2, socket_connect_timeout=2)

    return _client


# el correo se normaliza para que las mayusculas o los espacios no esquiven el contador
def _key(scope: str, identifier: str) -> str:
    normalized = (identifier or "").strip().lower()[:200]
    return f"ratelimit:{scope}:{normalized}"


# ejecuta una operacion contra redis, devuelve none si redis no responde
def _run(operation):
    global _unavailable_until

    if time.monotonic() < _unavailable_until:
        return None

    try:
        return operation(_get_client())
    except redis.RedisError as e:
        _unavailable_until = time.monotonic() + REDIS_RETRY_SECONDS
        logger.warning(f"redis no responde, el limite de intentos se omite un rato: {e}")
        return None


def _too_many(retry_after: int) -> HTTPException:
    return HTTPException(
        status_code=429,
        detail="Demasiados intentos, proba de nuevo mas tarde",
        headers={"Retry-After": str(max(retry_after, 1))},
    )


# suma uno al contador y le pone vencimiento la primera vez, o si se quedo sin vencimiento
def _increment(key: str, window: int):
    def operation(client):
        count = client.incr(key)

        if count == 1 or client.ttl(key) == -1:
            client.expire(key, window)

        return count

    return _run(operation)


# corta con 429 si el contador ya llego al limite, no suma nada
def ensure_allowed(scope: str, identifier: str, limit: int) -> None:
    key = _key(scope, identifier)
    count = _run(lambda client: client.get(key))

    if count is not None and int(count) >= limit:
        raise _too_many(_run(lambda client: client.ttl(key)) or 0)


# suma un intento fallido
def record_failure(scope: str, identifier: str, window: int) -> None:
    _increment(_key(scope, identifier), window)


# borra el contador, por ejemplo despues de un login correcto
def reset(scope: str, identifier: str) -> None:
    key = _key(scope, identifier)
    _run(lambda client: client.delete(key))


# suma un pedido y corta con 429 si pasa el limite de la ventana
def hit(scope: str, identifier: str, limit: int, window: int) -> None:
    key = _key(scope, identifier)
    count = _increment(key, window)

    if count is not None and count > limit:
        raise _too_many(_run(lambda client: client.ttl(key)) or 0)
