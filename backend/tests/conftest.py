"""Configuracion compartida de los tests."""

import pytest
from unittest.mock import patch
from app.core.llm_config import LlmConfig, OPENAI_BASE_URL

# los clientes del llm leen la configuracion efectiva de la base, en los tests se les fija una configuracion de entorno
# para que ninguno consulte la base real, create=True permite que este fixture exista antes de que los clientes importen el resolutor
LLM_CONFIG_TARGETS = [
    "app.modules.response_generator.llm_client.get_llm_config",
    "app.modules.ticket_analyzer.llm_client.get_llm_config",
    "app.modules.knowledge_indexer.embedding_client.get_llm_config",
]


@pytest.fixture(autouse=True)
def fixed_llm_config():
    config = LlmConfig(
        provider="openai", chat_model="gpt-4o-mini", api_key="test-key", base_url=OPENAI_BASE_URL,
        embedding_api_key="test-key", embedding_model="text-embedding-3-small", source="environment", updated_at=None,
    )
    patches = [patch(target, return_value=config, create=True) for target in LLM_CONFIG_TARGETS]
    for active_patch in patches:
        active_patch.start()
    yield
    for active_patch in patches:
        active_patch.stop()
