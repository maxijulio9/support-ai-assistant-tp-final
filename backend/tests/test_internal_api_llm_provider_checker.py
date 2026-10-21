"""Tests unitarios para la validacion de claves y modelos contra los proveedores del LLM.
Se mockea el cliente asincrono de OpenAI, sin tocar la red."""

from types import SimpleNamespace
from unittest.mock import patch, AsyncMock
import httpx
import pytest
from openai import APIConnectionError, AuthenticationError, BadRequestError, NotFoundError, RateLimitError
from app.core.llm_config import OPENAI_BASE_URL, GEMINI_BASE_URL
from app.modules.internal_api.clients.llm_provider_checker import (
    LlmProviderChecker,
    InvalidApiKeyError,
    NoChatModelsError,
    ModelNotCompatibleError,
    ProviderUnavailableError,
    EMBEDDING_DIMENSIONS,
)

CLIENT = "app.modules.internal_api.clients.llm_provider_checker.AsyncOpenAI"


# arma un error de estado HTTP del SDK, como los que devuelve un proveedor
def _status_error(error_class, status_code, message="error"):
    request = httpx.Request("POST", "https://example.test")
    response = httpx.Response(status_code, request=request)
    return error_class(message, response=response, body=None)


# arma la respuesta de listar modelos con los ids indicados
def _models(*ids):
    return SimpleNamespace(data=[SimpleNamespace(id=model_id) for model_id in ids])


# arma la respuesta de una llamada de chat con el contenido indicado
def _chat_response(content):
    return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=content))])


# verifica que de OpenAI se quedan solo los modelos de chat, sin versiones con fecha, y ordenados
@patch(CLIENT)
@pytest.mark.asyncio
async def test_list_chat_models_filters_openai_candidates_and_sorts(mock_client_class):
    mock_client_class.return_value.models.list = AsyncMock(return_value=_models(
        "gpt-4o", "gpt-4o-mini", "gpt-4o-2024-08-06", "gpt-4o-audio-preview", "gpt-4o-realtime-preview",
        "text-embedding-3-small", "whisper-1", "tts-1", "dall-e-3", "gpt-4.1",
    ))

    result = await LlmProviderChecker().list_chat_models("openai", "key-1")

    assert result == ["gpt-4.1", "gpt-4o", "gpt-4o-mini"]
    assert mock_client_class.call_args.kwargs["api_key"] == "key-1"
    assert mock_client_class.call_args.kwargs["base_url"] == OPENAI_BASE_URL


# verifica que de Gemini se quita el prefijo models/ y se descartan los de embeddings, imagen y voz
@patch(CLIENT)
@pytest.mark.asyncio
async def test_list_chat_models_strips_the_gemini_prefix_and_filters(mock_client_class):
    mock_client_class.return_value.models.list = AsyncMock(return_value=_models(
        "models/gemini-2.5-flash", "models/gemini-2.5-pro", "models/gemini-embedding-001",
        "models/gemini-2.5-flash-image", "models/gemini-2.5-flash-preview-tts", "models/text-embedding-004",
    ))

    result = await LlmProviderChecker().list_chat_models("gemini", "key-2")

    assert result == ["gemini-2.5-flash", "gemini-2.5-pro"]
    assert mock_client_class.call_args.kwargs["base_url"] == GEMINI_BASE_URL


# verifica que una clave rechazada por OpenAI se traduce en un error de clave invalida
@patch(CLIENT)
@pytest.mark.asyncio
async def test_list_chat_models_invalid_openai_key(mock_client_class):
    mock_client_class.return_value.models.list = AsyncMock(side_effect=_status_error(AuthenticationError, 401))

    with pytest.raises(InvalidApiKeyError, match="OpenAI"):
        await LlmProviderChecker().list_chat_models("openai", "mala")


# verifica que Gemini, que responde 400 ante una clave invalida al listar, tambien se traduce en clave invalida
@patch(CLIENT)
@pytest.mark.asyncio
async def test_list_chat_models_gemini_400_is_an_invalid_key(mock_client_class):
    mock_client_class.return_value.models.list = AsyncMock(side_effect=_status_error(BadRequestError, 400))

    with pytest.raises(InvalidApiKeyError, match="Gemini"):
        await LlmProviderChecker().list_chat_models("gemini", "mala")


# verifica que una cuenta sin modelos de chat se rechaza con un error claro
@patch(CLIENT)
@pytest.mark.asyncio
async def test_list_chat_models_account_without_chat_models(mock_client_class):
    mock_client_class.return_value.models.list = AsyncMock(return_value=_models("text-embedding-3-small"))

    with pytest.raises(NoChatModelsError, match="no tiene modelos de chat"):
        await LlmProviderChecker().list_chat_models("openai", "key-1")


# verifica que un proveedor que no responde se traduce en un error de proveedor no disponible
@patch(CLIENT)
@pytest.mark.asyncio
async def test_list_chat_models_connection_error_is_unavailable(mock_client_class):
    request = httpx.Request("GET", "https://example.test")
    mock_client_class.return_value.models.list = AsyncMock(side_effect=APIConnectionError(request=request))

    with pytest.raises(ProviderUnavailableError, match="No se pudo conectar"):
        await LlmProviderChecker().list_chat_models("openai", "key-1")


# verifica que un limite de velocidad del proveedor tambien se trata como no disponible
@patch(CLIENT)
@pytest.mark.asyncio
async def test_list_chat_models_rate_limit_is_unavailable(mock_client_class):
    mock_client_class.return_value.models.list = AsyncMock(side_effect=_status_error(RateLimitError, 429))

    with pytest.raises(ProviderUnavailableError):
        await LlmProviderChecker().list_chat_models("openai", "key-1")


# verifica que la prueba del modelo usa salida estructurada estricta y temperatura fija, como el pipeline
@patch(CLIENT)
@pytest.mark.asyncio
async def test_probe_chat_model_uses_the_pipeline_features(mock_client_class):
    create = AsyncMock(return_value=_chat_response('{"ok": true}'))
    mock_client_class.return_value.chat.completions.create = create

    await LlmProviderChecker().probe_chat_model("openai", "key-1", "gpt-4o-mini")

    kwargs = create.call_args.kwargs
    assert kwargs["model"] == "gpt-4o-mini"
    assert kwargs["temperature"] == 0
    assert kwargs["response_format"]["type"] == "json_schema"
    assert kwargs["response_format"]["json_schema"]["strict"] is True


# verifica que un modelo inexistente o sin acceso se rechaza con un mensaje claro
@patch(CLIENT)
@pytest.mark.asyncio
async def test_probe_chat_model_not_found(mock_client_class):
    mock_client_class.return_value.chat.completions.create = AsyncMock(side_effect=_status_error(NotFoundError, 404))

    with pytest.raises(ModelNotCompatibleError, match="no existe o la cuenta no tiene acceso"):
        await LlmProviderChecker().probe_chat_model("openai", "key-1", "modelo-inexistente")


# verifica que un modelo que rechaza los parametros del sistema se informa como no compatible, con el detalle del proveedor
@patch(CLIENT)
@pytest.mark.asyncio
async def test_probe_chat_model_bad_request_is_not_compatible(mock_client_class):
    mock_client_class.return_value.chat.completions.create = AsyncMock(
        side_effect=_status_error(BadRequestError, 400, "Unsupported value: temperature")
    )

    with pytest.raises(ModelNotCompatibleError, match="no es compatible con el sistema: Unsupported value: temperature"):
        await LlmProviderChecker().probe_chat_model("openai", "key-1", "o1")


# verifica que un modelo que no devuelve un JSON valido se rechaza
@patch(CLIENT)
@pytest.mark.asyncio
async def test_probe_chat_model_invalid_json_is_not_compatible(mock_client_class):
    mock_client_class.return_value.chat.completions.create = AsyncMock(return_value=_chat_response("hola, no soy un json"))

    with pytest.raises(ModelNotCompatibleError, match="JSON"):
        await LlmProviderChecker().probe_chat_model("openai", "key-1", "gpt-4o-mini")


# verifica que la prueba de embeddings usa el modelo indicado y acepta un vector de la dimension esperada
@patch(CLIENT)
@pytest.mark.asyncio
async def test_probe_embeddings_accepts_the_expected_dimension(mock_client_class):
    create = AsyncMock(return_value=SimpleNamespace(data=[SimpleNamespace(embedding=[0.1] * EMBEDDING_DIMENSIONS)]))
    mock_client_class.return_value.embeddings.create = create

    await LlmProviderChecker().probe_embeddings("key-1", "text-embedding-3-small")

    assert create.call_args.kwargs["model"] == "text-embedding-3-small"
    assert mock_client_class.call_args.kwargs["base_url"] == OPENAI_BASE_URL


# verifica que un vector de otra dimension se rechaza, porque no entra en la columna de la base
@patch(CLIENT)
@pytest.mark.asyncio
async def test_probe_embeddings_rejects_a_different_dimension(mock_client_class):
    mock_client_class.return_value.embeddings.create = AsyncMock(
        return_value=SimpleNamespace(data=[SimpleNamespace(embedding=[0.1] * 3072)])
    )

    with pytest.raises(ModelNotCompatibleError, match="3072 dimensiones"):
        await LlmProviderChecker().probe_embeddings("key-1", "text-embedding-3-large")
