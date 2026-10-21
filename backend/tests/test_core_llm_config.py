"""Tests unitarios para la resolucion de la configuracion efectiva del LLM.
Se mockean la base de datos, el cifrado, la configuracion del entorno y el reloj, sin tocar nada real."""

from datetime import datetime, timezone
from unittest.mock import patch, MagicMock
import pytest
from app.core.llm_config import (
    get_llm_config,
    invalidate_llm_config_cache,
    CACHE_TTL_SECONDS,
    OPENAI_BASE_URL,
    GEMINI_BASE_URL,
)

MODULE = "app.core.llm_config"
STORED_AT = datetime(2026, 10, 20, 12, 0, tzinfo=timezone.utc)


# arranca y termina cada test con la cache vacia, para que no se contaminen entre si
@pytest.fixture(autouse=True)
def clear_cache():
    invalidate_llm_config_cache()
    yield
    invalidate_llm_config_cache()


# arma una configuracion de entorno simulada, con los valores por defecto del sistema
def _env(**overrides):
    values = {
        "llm_provider": "openai",
        "openai_api_key": "env-openai-key",
        "openai_llm_model": "gpt-4o-mini",
        "gemini_api_key": "env-gemini-key",
        "gemini_llm_model": "gemini-2.5-flash",
        "openai_embedding_model": "text-embedding-3-small",
    }
    values.update(overrides)
    env = MagicMock()
    for key, value in values.items():
        setattr(env, key, value)
    return env


# arma una fila simulada de system_config
def _row(key, value):
    row = MagicMock()
    row.key = key
    row.encrypted_value = value
    row.updated_at = STORED_AT
    return row


# deja la sesion simulada devolviendo las filas indicadas, cada llamada a get_db entrega una sesion nueva
def _mock_db(mock_get_db, rows):
    mock_db = MagicMock()
    mock_db.execute.return_value.fetchall.return_value = rows
    mock_get_db.side_effect = lambda: iter([mock_db])
    return mock_db


# verifica que sin nada guardado se usa la configuracion del entorno
@patch(f"{MODULE}.SecretCipher")
@patch(f"{MODULE}.get_db")
@patch(f"{MODULE}.settings", _env())
def test_uses_the_environment_when_nothing_is_stored(mock_get_db, mock_cipher_class):
    _mock_db(mock_get_db, [])

    config = get_llm_config()

    assert config.source == "environment"
    assert config.provider == "openai"
    assert config.chat_model == "gpt-4o-mini"
    assert config.api_key == "env-openai-key"
    assert config.base_url == OPENAI_BASE_URL
    assert config.embedding_api_key == "env-openai-key"
    assert config.embedding_model == "text-embedding-3-small"
    assert config.updated_at is None


# verifica que lo guardado en la base tiene prioridad sobre el entorno y se desencripta
@patch(f"{MODULE}.SecretCipher")
@patch(f"{MODULE}.get_db")
@patch(f"{MODULE}.settings", _env())
def test_stored_values_take_priority_over_the_environment(mock_get_db, mock_cipher_class):
    mock_cipher_class.return_value.decrypt.side_effect = lambda value: value.replace("enc-", "dec-")
    _mock_db(mock_get_db, [_row("llm_chat_model", "enc-model"), _row("openai_api_key", "enc-key")])

    config = get_llm_config()

    assert config.source == "database"
    assert config.chat_model == "dec-model"
    assert config.api_key == "dec-key"
    assert config.embedding_api_key == "dec-key"
    assert config.updated_at == STORED_AT


# verifica que con Gemini la generacion usa su clave y su url, y los embeddings siguen usando la clave de OpenAI
@patch(f"{MODULE}.SecretCipher")
@patch(f"{MODULE}.get_db")
@patch(f"{MODULE}.settings", _env())
def test_gemini_generates_with_its_key_and_embeddings_keep_the_openai_key(mock_get_db, mock_cipher_class):
    decrypted = {"enc-provider": "gemini", "enc-gemini": "gemini-key", "enc-openai": "openai-key"}
    mock_cipher_class.return_value.decrypt.side_effect = lambda value: decrypted[value]
    _mock_db(mock_get_db, [
        _row("llm_provider", "enc-provider"),
        _row("gemini_api_key", "enc-gemini"),
        _row("openai_api_key", "enc-openai"),
    ])

    config = get_llm_config()

    assert config.provider == "gemini"
    assert config.api_key == "gemini-key"
    assert config.base_url == GEMINI_BASE_URL
    assert config.chat_model == "gemini-2.5-flash"
    assert config.embedding_api_key == "openai-key"
    assert config.embedding_model == "text-embedding-3-small"


# verifica que lo que falta en la base se completa con el entorno, sin perder el origen database
@patch(f"{MODULE}.SecretCipher")
@patch(f"{MODULE}.get_db")
@patch(f"{MODULE}.settings", _env())
def test_missing_stored_values_fall_back_to_the_environment(mock_get_db, mock_cipher_class):
    mock_cipher_class.return_value.decrypt.side_effect = lambda value: value.replace("enc-", "dec-")
    _mock_db(mock_get_db, [_row("llm_chat_model", "enc-model")])

    config = get_llm_config()

    assert config.source == "database"
    assert config.chat_model == "dec-model"
    assert config.api_key == "env-openai-key"


# verifica que la base se consulta una sola vez mientras la cache vale, y de nuevo cuando vence
@patch(f"{MODULE}.monotonic")
@patch(f"{MODULE}.SecretCipher")
@patch(f"{MODULE}.get_db")
@patch(f"{MODULE}.settings", _env())
def test_cache_is_reused_until_it_expires(mock_get_db, mock_cipher_class, mock_monotonic):
    clock = [100.0]
    mock_monotonic.side_effect = lambda: clock[0]
    _mock_db(mock_get_db, [])

    get_llm_config()
    get_llm_config()
    assert mock_get_db.call_count == 1

    clock[0] = 100.0 + CACHE_TTL_SECONDS + 1
    get_llm_config()
    assert mock_get_db.call_count == 2


# verifica que descartar la cache obliga a consultar la base en el proximo uso
@patch(f"{MODULE}.SecretCipher")
@patch(f"{MODULE}.get_db")
@patch(f"{MODULE}.settings", _env())
def test_invalidating_the_cache_forces_a_new_read(mock_get_db, mock_cipher_class):
    _mock_db(mock_get_db, [])

    get_llm_config()
    invalidate_llm_config_cache()
    get_llm_config()

    assert mock_get_db.call_count == 2


# verifica que si la base falla se usa el entorno sin lanzar error, y no se cachea para reintentar
@patch(f"{MODULE}.SecretCipher")
@patch(f"{MODULE}.get_db")
@patch(f"{MODULE}.settings", _env())
def test_database_failure_falls_back_to_the_environment_without_caching(mock_get_db, mock_cipher_class):
    mock_get_db.side_effect = Exception("sin conexion")

    first = get_llm_config()
    second = get_llm_config()

    assert first.source == "environment"
    assert first.api_key == "env-openai-key"
    assert second.source == "environment"
    assert mock_get_db.call_count == 2
