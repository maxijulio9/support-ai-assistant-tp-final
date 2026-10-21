"""Tests unitarios para la configuracion del LLM desde el dashboard.
Se mockean los proveedores, la base de datos, el cifrado y la configuracion efectiva, sin tocar nada real."""

import json
import pytest
from datetime import datetime, timezone
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.main import app as main_app
from app.core.llm_config import LlmConfig, OPENAI_BASE_URL
from app.modules.auth.dependencies import require_admin
from app.modules.internal_api.router import router
from app.modules.internal_api.clients.llm_provider_checker import (
    InvalidApiKeyError,
    ModelNotCompatibleError,
    ProviderUnavailableError,
)
from app.modules.internal_api.services.llm_config_service import LlmConfigService

SERVICE = "app.modules.internal_api.services.llm_config_service"
ROUTER_SERVICE = "app.modules.internal_api.router._llm_config_service"
UPDATED_AT = datetime(2026, 10, 20, 12, 0, tzinfo=timezone.utc)

app = FastAPI()
app.include_router(router)
client = TestClient(app)


# arma una configuracion efectiva de prueba
def _config(**overrides):
    values = {
        "provider": "openai", "chat_model": "gpt-4o-mini", "api_key": "env-key", "base_url": OPENAI_BASE_URL,
        "embedding_api_key": "env-key", "embedding_model": "text-embedding-3-small", "source": "environment", "updated_at": None,
    }
    values.update(overrides)
    return LlmConfig(**values)


# arma el servicio con el verificador de proveedores y el cifrado simulados
def _build_service():
    service = LlmConfigService.__new__(LlmConfigService)
    service.checker = MagicMock()
    service.checker.list_chat_models = AsyncMock(return_value=["gpt-4o", "gpt-4o-mini"])
    service.checker.probe_chat_model = AsyncMock()
    service.checker.probe_embeddings = AsyncMock()
    service.cipher = MagicMock()
    service.cipher.encrypt.side_effect = lambda value: f"enc:{value}"
    return service


# devuelve lo que se escribio en la base, clave y valor cifrado
def _saved(mock_db):
    return {call[0][1]["key"]: call[0][1]["encrypted_value"] for call in mock_db.execute.call_args_list}


# verifica que el estado desde el entorno informa el origen, los modelos y que no hay fecha de guardado
@patch(f"{SERVICE}.get_llm_config")
def test_status_from_the_environment(mock_get_config):
    mock_get_config.return_value = _config()

    result = _build_service().get_status()

    assert result == {
        "generation": {"provider": "openai", "model": "gpt-4o-mini", "configured": True},
        "embeddings": {"provider": "openai", "model": "text-embedding-3-small", "configured": True},
        "source": "environment",
        "updated_at": None,
    }


# verifica que el estado desde la base informa el origen y la fecha del ultimo guardado
@patch(f"{SERVICE}.get_llm_config")
def test_status_from_the_database_includes_the_saved_date(mock_get_config):
    mock_get_config.return_value = _config(source="database", updated_at=UPDATED_AT)

    result = _build_service().get_status()

    assert result["source"] == "database"
    assert result["updated_at"] == UPDATED_AT.isoformat()


# verifica que sin claves disponibles las dos partes figuran sin configurar
@patch(f"{SERVICE}.get_llm_config")
def test_status_without_keys_is_not_configured(mock_get_config):
    mock_get_config.return_value = _config(api_key="", embedding_api_key="")

    result = _build_service().get_status()

    assert result["generation"]["configured"] is False
    assert result["embeddings"]["configured"] is False


# verifica que listar los modelos delega en el verificador, con la clave recortada
@pytest.mark.asyncio
async def test_list_models_delegates_with_the_trimmed_key():
    service = _build_service()

    result = await service.list_models("openai", "  key-1  ")

    assert result == ["gpt-4o", "gpt-4o-mini"]
    service.checker.list_chat_models.assert_awaited_once_with("openai", "key-1")


# verifica que con openai se valida con la clave compartida, se guarda cifrado y se descarta la cache
@patch(f"{SERVICE}.invalidate_llm_config_cache")
@patch(f"{SERVICE}.get_db")
@patch(f"{SERVICE}.get_llm_config")
@pytest.mark.asyncio
async def test_save_openai_validates_with_the_shared_key_and_persists_encrypted(mock_get_config, mock_get_db, mock_invalidate):
    mock_get_config.return_value = _config()
    mock_db = MagicMock()
    mock_get_db.return_value = iter([mock_db])
    service = _build_service()

    await service.save("openai", "gpt-4o-mini", None, "openai-key")

    service.checker.probe_embeddings.assert_awaited_once_with("openai-key", "text-embedding-3-small")
    service.checker.list_chat_models.assert_awaited_once_with("openai", "openai-key")
    service.checker.probe_chat_model.assert_awaited_once_with("openai", "openai-key", "gpt-4o-mini")
    assert _saved(mock_db) == {
        "llm_provider": "enc:openai",
        "llm_chat_model": "enc:gpt-4o-mini",
        "openai_api_key": "enc:openai-key",
    }
    mock_db.commit.assert_called_once()
    mock_invalidate.assert_called_once()


# verifica que con gemini se valida cada parte con su clave y se guardan las dos claves
@patch(f"{SERVICE}.invalidate_llm_config_cache")
@patch(f"{SERVICE}.get_db")
@patch(f"{SERVICE}.get_llm_config")
@pytest.mark.asyncio
async def test_save_gemini_uses_each_key_for_its_part_and_stores_both(mock_get_config, mock_get_db, mock_invalidate):
    mock_get_config.return_value = _config()
    mock_db = MagicMock()
    mock_get_db.return_value = iter([mock_db])
    service = _build_service()

    await service.save("gemini", "gemini-2.5-flash", "gemini-key", "openai-key")

    service.checker.probe_embeddings.assert_awaited_once_with("openai-key", "text-embedding-3-small")
    service.checker.list_chat_models.assert_awaited_once_with("gemini", "gemini-key")
    service.checker.probe_chat_model.assert_awaited_once_with("gemini", "gemini-key", "gemini-2.5-flash")
    assert _saved(mock_db) == {
        "llm_provider": "enc:gemini",
        "llm_chat_model": "enc:gemini-2.5-flash",
        "openai_api_key": "enc:openai-key",
        "gemini_api_key": "enc:gemini-key",
    }
    mock_invalidate.assert_called_once()


# verifica que con gemini y sin su clave se rechaza antes de consultar ningun proveedor ni la base
@patch(f"{SERVICE}.get_db")
@patch(f"{SERVICE}.get_llm_config")
@pytest.mark.asyncio
async def test_save_gemini_without_its_key_is_rejected_before_any_call(mock_get_config, mock_get_db):
    service = _build_service()

    with pytest.raises(ValueError, match="Gemini"):
        await service.save("gemini", "gemini-2.5-flash", None, "openai-key")

    service.checker.probe_embeddings.assert_not_awaited()
    mock_get_db.assert_not_called()


# verifica que si falla la prueba del modelo no se escribe nada ni se descarta la cache
@patch(f"{SERVICE}.invalidate_llm_config_cache")
@patch(f"{SERVICE}.get_db")
@patch(f"{SERVICE}.get_llm_config")
@pytest.mark.asyncio
async def test_save_does_not_persist_when_the_model_probe_fails(mock_get_config, mock_get_db, mock_invalidate):
    mock_get_config.return_value = _config()
    service = _build_service()
    service.checker.probe_chat_model = AsyncMock(side_effect=ModelNotCompatibleError("El modelo o1 no es compatible con el sistema"))

    with pytest.raises(ModelNotCompatibleError, match="o1"):
        await service.save("openai", "o1", None, "openai-key")

    mock_get_db.assert_not_called()
    mock_invalidate.assert_not_called()


# verifica que si falla la base se deshace la transaccion y no se descarta la cache
@patch(f"{SERVICE}.invalidate_llm_config_cache")
@patch(f"{SERVICE}.get_db")
@patch(f"{SERVICE}.get_llm_config")
@pytest.mark.asyncio
async def test_save_rolls_back_when_the_database_fails(mock_get_config, mock_get_db, mock_invalidate):
    mock_get_config.return_value = _config()
    mock_db = MagicMock()
    mock_db.execute.side_effect = Exception("falla de bd")
    mock_get_db.return_value = iter([mock_db])
    service = _build_service()

    with pytest.raises(Exception, match="falla de bd"):
        await service.save("openai", "gpt-4o-mini", None, "openai-key")

    mock_db.rollback.assert_called_once()
    mock_db.commit.assert_not_called()
    mock_invalidate.assert_not_called()


# verifica que una clave de OpenAI en blanco se rechaza antes de consultar ningun proveedor
@pytest.mark.asyncio
async def test_save_rejects_a_blank_openai_key():
    service = _build_service()

    with pytest.raises(ValueError, match="OpenAI"):
        await service.save("openai", "gpt-4o-mini", None, "   ")

    service.checker.probe_embeddings.assert_not_awaited()


# verifica que el endpoint del estado devuelve 200 con la forma esperada y sin ninguna clave
@patch(ROUTER_SERVICE)
def test_get_status_returns_the_shape_without_any_key(mock_service):
    mock_service.get_status.return_value = {
        "generation": {"provider": "openai", "model": "gpt-4o-mini", "configured": True},
        "embeddings": {"provider": "openai", "model": "text-embedding-3-small", "configured": True},
        "source": "database",
        "updated_at": UPDATED_AT.isoformat(),
    }

    app.dependency_overrides[require_admin] = lambda: MagicMock(id="admin-1", role="admin")

    response = client.get("/api/config/llm")

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["generation"]["model"] == "gpt-4o-mini"
    assert "key" not in json.dumps(response.json()).replace("api_key", "").lower().replace("keyboard", "")


# verifica que un error inesperado al consultar el estado se traduce en HTTP 503
@patch(ROUTER_SERVICE)
def test_get_status_unexpected_error_returns_503(mock_service):
    mock_service.get_status.side_effect = Exception("falla de bd")

    app.dependency_overrides[require_admin] = lambda: MagicMock(id="admin-1", role="admin")

    response = client.get("/api/config/llm")

    app.dependency_overrides.clear()

    assert response.status_code == 503


# verifica que el endpoint de modelos devuelve 200 con la lista de modelos de chat
@patch(ROUTER_SERVICE)
def test_list_models_returns_the_chat_models(mock_service):
    mock_service.list_models = AsyncMock(return_value=["gpt-4o", "gpt-4o-mini"])

    app.dependency_overrides[require_admin] = lambda: MagicMock(id="admin-1", role="admin")

    response = client.post("/api/config/llm/models", json={"provider": "openai", "api_key": "key-1"})

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == {"chat_models": ["gpt-4o", "gpt-4o-mini"]}
    mock_service.list_models.assert_awaited_once_with("openai", "key-1")


# verifica que una clave invalida se traduce en HTTP 400 con el mensaje en texto legible
@patch(ROUTER_SERVICE)
def test_list_models_invalid_key_returns_400_with_a_readable_detail(mock_service):
    mock_service.list_models = AsyncMock(side_effect=InvalidApiKeyError("La API key de OpenAI no es valida"))

    app.dependency_overrides[require_admin] = lambda: MagicMock(id="admin-1", role="admin")

    response = client.post("/api/config/llm/models", json={"provider": "openai", "api_key": "mala"})

    app.dependency_overrides.clear()

    assert response.status_code == 400
    assert response.json()["detail"] == "La API key de OpenAI no es valida"


# verifica que un proveedor que no responde se traduce en HTTP 503 con el mensaje del error
@patch(ROUTER_SERVICE)
def test_list_models_unavailable_provider_returns_503(mock_service):
    mock_service.list_models = AsyncMock(side_effect=ProviderUnavailableError("No se pudo conectar con Gemini"))

    app.dependency_overrides[require_admin] = lambda: MagicMock(id="admin-1", role="admin")

    response = client.post("/api/config/llm/models", json={"provider": "gemini", "api_key": "key-2"})

    app.dependency_overrides.clear()

    assert response.status_code == 503
    assert response.json()["detail"] == "No se pudo conectar con Gemini"


# verifica que guardar devuelve 200 con status ok y le pasa los datos al servicio
@patch(ROUTER_SERVICE)
def test_save_returns_ok_and_passes_the_data_to_the_service(mock_service):
    mock_service.save = AsyncMock()

    app.dependency_overrides[require_admin] = lambda: MagicMock(id="admin-1", role="admin")

    body = {"generation": {"provider": "gemini", "model": "gemini-2.5-flash", "api_key": "gemini-key"}, "embeddings": {"api_key": "openai-key"}}
    response = client.post("/api/config/llm", json=body)

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    mock_service.save.assert_awaited_once_with("gemini", "gemini-2.5-flash", "gemini-key", "openai-key")


# verifica que un modelo incompatible se traduce en HTTP 400 con el mensaje en texto legible
@patch(ROUTER_SERVICE)
def test_save_incompatible_model_returns_400_with_a_readable_detail(mock_service):
    mock_service.save = AsyncMock(side_effect=ModelNotCompatibleError("El modelo o1 no es compatible con el sistema: Unsupported value: temperature"))

    app.dependency_overrides[require_admin] = lambda: MagicMock(id="admin-1", role="admin")

    body = {"generation": {"provider": "openai", "model": "o1"}, "embeddings": {"api_key": "openai-key"}}
    response = client.post("/api/config/llm", json=body)

    app.dependency_overrides.clear()

    assert response.status_code == 400
    assert "no es compatible con el sistema" in response.json()["detail"]


# verifica que un proveedor que no responde al guardar se traduce en HTTP 503
@patch(ROUTER_SERVICE)
def test_save_unavailable_provider_returns_503(mock_service):
    mock_service.save = AsyncMock(side_effect=ProviderUnavailableError("No se pudo conectar con OpenAI"))

    app.dependency_overrides[require_admin] = lambda: MagicMock(id="admin-1", role="admin")

    body = {"generation": {"provider": "openai", "model": "gpt-4o-mini"}, "embeddings": {"api_key": "openai-key"}}
    response = client.post("/api/config/llm", json=body)

    app.dependency_overrides.clear()

    assert response.status_code == 503
    assert response.json()["detail"] == "No se pudo conectar con OpenAI"


# verifica que un proveedor no soportado se rechaza con 422 antes de llegar al servicio
@patch(ROUTER_SERVICE)
def test_save_unsupported_provider_returns_422(mock_service):
    mock_service.save = AsyncMock()

    app.dependency_overrides[require_admin] = lambda: MagicMock(id="admin-1", role="admin")

    body = {"generation": {"provider": "azure", "model": "gpt-4o"}, "embeddings": {"api_key": "openai-key"}}
    response = client.post("/api/config/llm", json=body)

    app.dependency_overrides.clear()

    assert response.status_code == 422
    mock_service.save.assert_not_awaited()


# verifica que sin la clave de embeddings se rechaza con 422, porque es obligatoria siempre
@patch(ROUTER_SERVICE)
def test_save_without_the_embeddings_key_returns_422(mock_service):
    mock_service.save = AsyncMock()

    app.dependency_overrides[require_admin] = lambda: MagicMock(id="admin-1", role="admin")

    body = {"generation": {"provider": "openai", "model": "gpt-4o-mini"}, "embeddings": {}}
    response = client.post("/api/config/llm", json=body)

    app.dependency_overrides.clear()

    assert response.status_code == 422
    mock_service.save.assert_not_awaited()


# verifica en el contrato que las tres rutas existen y que ninguna respuesta declara una clave
def test_contract_declares_the_three_routes_and_no_key_in_the_responses():
    spec = main_app.openapi()
    paths = spec["paths"]
    schemas = spec["components"]["schemas"]

    assert "get" in paths["/api/config/llm"]
    assert "post" in paths["/api/config/llm"]
    assert "post" in paths["/api/config/llm/models"]

    for name in ("LlmConfigResponse", "LlmGenerationStatus", "LlmEmbeddingsStatus", "LlmModelsResponse", "SaveLlmConfigResponse"):
        assert "api_key" not in schemas[name]["properties"]
