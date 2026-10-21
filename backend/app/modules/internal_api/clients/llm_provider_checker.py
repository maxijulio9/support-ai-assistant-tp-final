# M7 InternalAPI
# valida las claves y los modelos de los proveedores del llm antes de guardarlos
# usa el mismo cliente que usa el sistema, apuntado a openai o a gemini, y solo lee, no guarda nada

import json
import logging
import re
from openai import (
    AsyncOpenAI,
    AuthenticationError,
    BadRequestError,
    NotFoundError,
    PermissionDeniedError,
)
from app.core.llm_config import OPENAI_BASE_URL, GEMINI_BASE_URL

logger = logging.getLogger(__name__)

REQUEST_TIMEOUT_SECONDS = 20.0

# dimension de los vectores que acepta la columna de embeddings, es la del modelo text-embedding-3-small
EMBEDDING_DIMENSIONS = 1536

PROVIDERS = {
    "openai": {"label": "OpenAI", "base_url": OPENAI_BASE_URL, "model_prefix": "gpt-"},
    "gemini": {"label": "Gemini", "base_url": GEMINI_BASE_URL, "model_prefix": "gemini"},
}

# fragmentos que identifican modelos que no sirven para generar texto de chat con las funciones del sistema
EXCLUDED_FRAGMENTS = (
    "embedding", "audio", "realtime", "transcribe", "tts", "image", "search", "instruct", "moderation",
    "whisper", "dall-e", "live", "robotics", "computer-use", "research", "veo", "imagen", "aqa",
)

# versiones con fecha o numero de revision, como gpt-4o-2024-08-06, el alias sin fecha ya esta en la lista
SNAPSHOT_SUFFIX = re.compile(r"-(\d{4}-\d{2}-\d{2}|\d{4}|\d{3})$")


class LlmProviderError(Exception):
    pass


class InvalidApiKeyError(LlmProviderError):
    pass


class NoChatModelsError(LlmProviderError):
    pass


class ModelNotCompatibleError(LlmProviderError):
    pass


class ProviderUnavailableError(LlmProviderError):
    pass


class LlmProviderChecker:

    # devuelve los modelos de chat de la cuenta, ordenados, o lanza un error claro si la clave no sirve
    async def list_chat_models(self, provider: str, api_key: str) -> list[str]:
        client = self._client(provider, api_key)

        try:
            page = await client.models.list()
        except Exception as e:
            raise self._translate_error(e, provider) from e

        ids = {self._normalize_id(model.id) for model in page.data}
        chat_models = sorted(model_id for model_id in ids if self._is_chat_candidate(provider, model_id))

        if not chat_models:
            raise NoChatModelsError(f"La cuenta de {PROVIDERS[provider]['label']} no tiene modelos de chat disponibles")

        return chat_models

    # prueba el modelo con una llamada minima que usa las mismas funciones que el pipeline, salida estructurada estricta y temperatura fija
    # un modelo que no las soporta se rechaza aca y no despues, cuando el sistema ya lo esta usando
    async def probe_chat_model(self, provider: str, api_key: str, model: str) -> None:
        client = self._client(provider, api_key)

        try:
            response = await client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": "Responde con un JSON que tenga el campo ok en true."}],
                response_format={
                    "type": "json_schema",
                    "json_schema": {
                        "name": "compatibility_probe",
                        "strict": True,
                        "schema": {
                            "type": "object",
                            "properties": {"ok": {"type": "boolean"}},
                            "required": ["ok"],
                            "additionalProperties": False,
                        },
                    },
                },
                temperature=0,
            )
        except Exception as e:
            raise self._translate_error(e, provider, model) from e

        content = response.choices[0].message.content

        try:
            data = json.loads(content)
        except (TypeError, ValueError):
            data = None

        if not isinstance(data, dict) or "ok" not in data:
            raise ModelNotCompatibleError(f"El modelo {model} no es compatible con el sistema: no devolvio un JSON valido")

    # prueba que la cuenta de openai tenga acceso al modelo de embeddings y que el vector tenga la dimension de la columna
    async def probe_embeddings(self, api_key: str, model: str) -> None:
        client = self._client("openai", api_key)

        try:
            response = await client.embeddings.create(model=model, input="prueba")
        except Exception as e:
            raise self._translate_error(e, "openai", model) from e

        dimensions = len(response.data[0].embedding)

        if dimensions != EMBEDDING_DIMENSIONS:
            raise ModelNotCompatibleError(
                f"El modelo {model} no es compatible con el sistema: genera vectores de {dimensions} dimensiones y se esperan {EMBEDDING_DIMENSIONS}"
            )

    # arma el cliente del proveedor, sin reintentos y con un tiempo maximo para no dejar colgada la pantalla
    def _client(self, provider: str, api_key: str) -> AsyncOpenAI:
        if provider not in PROVIDERS:
            raise ValueError(f"proveedor no soportado: {provider}")

        return AsyncOpenAI(
            api_key=api_key,
            base_url=PROVIDERS[provider]["base_url"],
            timeout=REQUEST_TIMEOUT_SECONDS,
            max_retries=0,
        )

    # algunos proveedores devuelven el id con el prefijo models/
    def _normalize_id(self, model_id: str) -> str:
        return model_id.removeprefix("models/")

    # decide si un modelo parece de chat, la prueba real con probe_chat_model es la que lo confirma
    def _is_chat_candidate(self, provider: str, model_id: str) -> bool:
        if not model_id.startswith(PROVIDERS[provider]["model_prefix"]):
            return False
        if any(fragment in model_id for fragment in EXCLUDED_FRAGMENTS):
            return False
        return SNAPSHOT_SUFFIX.search(model_id) is None

    # traduce un error del proveedor a un error propio con un mensaje claro
    def _translate_error(self, error: Exception, provider: str, model: str | None = None) -> LlmProviderError:
        label = PROVIDERS[provider]["label"]

        if isinstance(error, (AuthenticationError, PermissionDeniedError)):
            return InvalidApiKeyError(f"La API key de {label} no es valida")

        if isinstance(error, NotFoundError) and model:
            return ModelNotCompatibleError(f"El modelo {model} no existe o la cuenta no tiene acceso")

        if isinstance(error, BadRequestError):
            if model is None:
                # algunos proveedores responden 400 ante una clave invalida al listar los modelos
                return InvalidApiKeyError(f"La API key de {label} no es valida")
            detail = str(getattr(error, "message", error))[:200]
            return ModelNotCompatibleError(f"El modelo {model} no es compatible con el sistema: {detail}")

        logger.warning(f"error al consultar {label}: {error}")
        return ProviderUnavailableError(f"No se pudo conectar con {label}")
