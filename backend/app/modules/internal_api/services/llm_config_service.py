# M7 InternalAPI
# configura el llm desde el dashboard, valida las claves y los modelos contra los proveedores y guarda la configuracion cifrada

import logging
from sqlalchemy import text
from app.core.database import get_db
from app.core.encryption import SecretCipher
from app.core.llm_config import (
    get_llm_config,
    invalidate_llm_config_cache,
    KEY_PROVIDER,
    KEY_CHAT_MODEL,
    KEY_OPENAI_API_KEY,
    KEY_GEMINI_API_KEY,
)
from app.modules.internal_api.clients.llm_provider_checker import LlmProviderChecker

logger = logging.getLogger(__name__)


class LlmConfigService:

    def __init__(self):
        self.checker = LlmProviderChecker()
        self.cipher = SecretCipher()

    # estado actual de la configuracion, nunca incluye las claves
    def get_status(self) -> dict:
        config = get_llm_config()

        return {
            "generation": {"provider": config.provider, "model": config.chat_model, "configured": bool(config.api_key)},
            "embeddings": {"provider": "openai", "model": config.embedding_model, "configured": bool(config.embedding_api_key)},
            "source": config.source,
            "updated_at": config.updated_at.isoformat() if config.updated_at else None,
        }

    # valida la clave contra el proveedor y devuelve los modelos de chat de la cuenta, sin guardar nada
    async def list_models(self, provider: str, api_key: str) -> list[str]:
        return await self.checker.list_chat_models(provider, api_key.strip())

    # valida todo contra los proveedores y recien despues guarda, si algo falla no se escribe nada
    # con openai se usa la misma clave para generar y para los embeddings, con gemini hacen falta las dos
    async def save(self, provider: str, model: str, generation_api_key: str | None, embeddings_api_key: str) -> None:
        embeddings_key = (embeddings_api_key or "").strip()

        if not embeddings_key:
            raise ValueError("La API key de OpenAI es obligatoria, los embeddings usan siempre OpenAI")

        if provider == "gemini":
            generation_key = (generation_api_key or "").strip()
            if not generation_key:
                raise ValueError("La API key de Gemini es obligatoria cuando el proveedor es Gemini")
        else:
            generation_key = embeddings_key

        embedding_model = get_llm_config().embedding_model

        await self.checker.probe_embeddings(embeddings_key, embedding_model)
        await self.checker.list_chat_models(provider, generation_key)
        await self.checker.probe_chat_model(provider, generation_key, model)

        values = {
            KEY_PROVIDER: provider,
            KEY_CHAT_MODEL: model,
            KEY_OPENAI_API_KEY: embeddings_key,
        }
        if provider == "gemini":
            values[KEY_GEMINI_API_KEY] = generation_key

        self._save_values(values)
        invalidate_llm_config_cache()

    # guarda los valores cifrados en una sola transaccion, actualiza si la clave ya existia
    def _save_values(self, values: dict[str, str]) -> None:
        db = next(get_db())

        try:
            for key, value in values.items():
                db.execute(
                    text("""
                        INSERT INTO system_config (key, encrypted_value)
                        VALUES (:key, :encrypted_value)
                        ON CONFLICT (key)
                        DO UPDATE SET encrypted_value = :encrypted_value, updated_at = NOW()
                    """),
                    {"key": key, "encrypted_value": self.cipher.encrypt(value)},
                )
            db.commit()
            logger.info("configuracion del llm guardada")

        except Exception as e:
            db.rollback()
            logger.error(f"error al guardar la configuracion del llm: {e}")
            raise

        finally:
            db.close()
