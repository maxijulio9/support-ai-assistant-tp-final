"""Tests unitarios para la lectura de la configuracion efectiva en los clientes del LLM.
Se mockean el cliente de OpenAI y el resolutor, sin tocar la red ni la base de datos."""

from unittest.mock import patch
from app.core.llm_config import LlmConfig, OPENAI_BASE_URL, GEMINI_BASE_URL
from app.modules.response_generator.llm_client import LlmClient as ResponseLlmClient
from app.modules.ticket_analyzer.llm_client import LlmClient as ClassifierLlmClient
from app.modules.knowledge_indexer.embedding_client import EmbeddingClient


# arma una configuracion efectiva de prueba, con los valores por defecto del entorno
def _config(**overrides):
    values = {
        "provider": "openai", "chat_model": "gpt-4o-mini", "api_key": "key-1", "base_url": OPENAI_BASE_URL,
        "embedding_api_key": "key-1", "embedding_model": "text-embedding-3-small", "source": "environment", "updated_at": None,
    }
    values.update(overrides)
    return LlmConfig(**values)


# verifica que el cliente de respuestas solo se reconstruye cuando cambia la configuracion, y usa el modelo nuevo
@patch("app.modules.response_generator.llm_client.OpenAI")
@patch("app.modules.response_generator.llm_client.get_llm_config")
def test_response_client_is_rebuilt_only_when_the_config_changes(mock_get_config, mock_openai_class):
    mock_get_config.return_value = _config()
    client = ResponseLlmClient()

    assert mock_openai_class.call_count == 1
    mock_openai_class.assert_called_with(api_key="key-1", base_url=OPENAI_BASE_URL)

    client.generate_response("hola")
    assert mock_openai_class.call_count == 1

    mock_get_config.return_value = _config(provider="gemini", api_key="key-2", base_url=GEMINI_BASE_URL, chat_model="gemini-2.5-flash")
    client.generate_response("hola")

    assert mock_openai_class.call_count == 2
    mock_openai_class.assert_called_with(api_key="key-2", base_url=GEMINI_BASE_URL)
    assert mock_openai_class.return_value.chat.completions.create.call_args.kwargs["model"] == "gemini-2.5-flash"


# verifica que el cliente de clasificacion usa el modelo de la configuracion efectiva en cada llamada
@patch("app.modules.ticket_analyzer.llm_client.OpenAI")
@patch("app.modules.ticket_analyzer.llm_client.get_llm_config")
def test_classifier_client_uses_the_configured_model(mock_get_config, mock_openai_class):
    mock_get_config.return_value = _config(chat_model="gpt-4.1-mini")
    client = ClassifierLlmClient()

    client.translate("hola", "pt")

    assert mock_openai_class.return_value.chat.completions.create.call_args.kwargs["model"] == "gpt-4.1-mini"


# verifica que los embeddings usan la clave de OpenAI y su modelo fijo aunque la generacion use Gemini
@patch("app.modules.knowledge_indexer.embedding_client.OpenAI")
@patch("app.modules.knowledge_indexer.embedding_client.get_llm_config")
def test_embedding_client_keeps_the_openai_key_when_generation_uses_gemini(mock_get_config, mock_openai_class):
    mock_get_config.return_value = _config(
        provider="gemini", api_key="gemini-key", base_url=GEMINI_BASE_URL, chat_model="gemini-2.5-flash", embedding_api_key="openai-key",
    )
    client = EmbeddingClient()

    client.generate_embedding("hola")

    mock_openai_class.assert_called_with(api_key="openai-key")
    assert mock_openai_class.return_value.embeddings.create.call_args.kwargs["model"] == "text-embedding-3-small"


# verifica que el cliente de embeddings se reconstruye cuando cambia la clave de OpenAI
@patch("app.modules.knowledge_indexer.embedding_client.OpenAI")
@patch("app.modules.knowledge_indexer.embedding_client.get_llm_config")
def test_embedding_client_is_rebuilt_when_the_openai_key_changes(mock_get_config, mock_openai_class):
    mock_get_config.return_value = _config()
    client = EmbeddingClient()
    assert mock_openai_class.call_count == 1

    client.generate_embedding("hola")
    assert mock_openai_class.call_count == 1

    mock_get_config.return_value = _config(embedding_api_key="key-2")
    client.generate_embedding("hola")

    assert mock_openai_class.call_count == 2
    mock_openai_class.assert_called_with(api_key="key-2")
