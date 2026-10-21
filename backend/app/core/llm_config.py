# core: resuelve la configuracion efectiva del llm, primero la guardada en la base y si no hay, las variables de entorno
# cachea el resultado unos segundos, porque la api y los workers son procesos distintos
# y asi un cambio guardado llega a todos sin reiniciar

import logging
from dataclasses import dataclass
from datetime import datetime
from time import monotonic
from sqlalchemy import text
from app.core.config import settings
from app.core.database import get_db
from app.core.encryption import SecretCipher

logger = logging.getLogger(__name__)

# segundos que se reutiliza la configuracion leida de la base antes de volver a consultarla
CACHE_TTL_SECONDS = 30

OPENAI_BASE_URL = "https://api.openai.com/v1"
GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/"

# claves de system_config donde se guarda la configuracion
KEY_PROVIDER = "llm_provider"
KEY_CHAT_MODEL = "llm_chat_model"
KEY_OPENAI_API_KEY = "openai_api_key"
KEY_GEMINI_API_KEY = "gemini_api_key"
CONFIG_KEYS = [KEY_PROVIDER, KEY_CHAT_MODEL, KEY_OPENAI_API_KEY, KEY_GEMINI_API_KEY]

SOURCE_DATABASE = "database"
SOURCE_ENVIRONMENT = "environment"


@dataclass(frozen=True)
class LlmConfig:
    provider: str
    chat_model: str
    # clave y url base del proveedor que genera las respuestas
    api_key: str
    base_url: str
    # los embeddings usan siempre openai, con su clave y su modelo fijo
    embedding_api_key: str
    embedding_model: str
    # de donde sale la configuracion, y cuando se guardo por ultima vez si salio de la base
    source: str
    updated_at: datetime | None


_cache = {"config": None, "expires_at": 0.0}


# devuelve la configuracion efectiva del llm, reutilizando la ultima lectura mientras no pase CACHE_TTL_SECONDS
def get_llm_config() -> LlmConfig:
    now = monotonic()

    if _cache["config"] is not None and now < _cache["expires_at"]:
        return _cache["config"]

    try:
        stored, updated_at = _read_stored_values()
    except Exception as e:
        # si la base no responde se usa la configuracion del entorno, y no se cachea para reintentar en el proximo uso
        logger.warning(f"no se pudo leer la configuracion del llm de la base, se usa la del entorno: {e}")
        return _build_config({}, None)

    config = _build_config(stored, updated_at)
    _cache["config"] = config
    _cache["expires_at"] = now + CACHE_TTL_SECONDS

    return config


# descarta la lectura guardada, la proxima llamada vuelve a consultar la base
def invalidate_llm_config_cache() -> None:
    _cache["config"] = None
    _cache["expires_at"] = 0.0


# lee de system_config los valores guardados y los desencripta, junto con la fecha del ultimo guardado
def _read_stored_values():
    db = next(get_db())

    try:
        rows = db.execute(
            text("SELECT key, encrypted_value, updated_at FROM system_config WHERE key = ANY(:keys)"),
            {"keys": CONFIG_KEYS},
        ).fetchall()
    finally:
        db.close()

    cipher = SecretCipher()
    stored = {row.key: cipher.decrypt(row.encrypted_value) for row in rows}
    updated_at = max((row.updated_at for row in rows), default=None)

    return stored, updated_at


# arma la configuracion final, cada valor sale de la base si esta guardado y si no, del entorno
def _build_config(stored: dict, updated_at: datetime | None) -> LlmConfig:
    provider = stored.get(KEY_PROVIDER) or settings.llm_provider
    openai_key = stored.get(KEY_OPENAI_API_KEY) or settings.openai_api_key
    gemini_key = stored.get(KEY_GEMINI_API_KEY) or settings.gemini_api_key

    if provider == "gemini":
        api_key = gemini_key
        base_url = GEMINI_BASE_URL
        default_model = settings.gemini_llm_model
    else:
        api_key = openai_key
        base_url = OPENAI_BASE_URL
        default_model = settings.openai_llm_model

    return LlmConfig(
        provider=provider,
        chat_model=stored.get(KEY_CHAT_MODEL) or default_model,
        api_key=api_key,
        base_url=base_url,
        embedding_api_key=openai_key,
        embedding_model=settings.openai_embedding_model,
        source=SOURCE_DATABASE if stored else SOURCE_ENVIRONMENT,
        updated_at=updated_at,
    )
