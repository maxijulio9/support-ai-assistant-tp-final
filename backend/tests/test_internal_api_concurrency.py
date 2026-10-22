"""Tests para que los endpoints que solo usan la base no bloqueen el servidor.
Se mockean la base y la autenticacion, sin tocar nada real."""

import asyncio
import inspect
import threading
import time
from types import SimpleNamespace
from unittest.mock import patch, MagicMock, AsyncMock

import httpx
import pytest

from app.main import app
from app.modules.auth import dependencies
from app.modules.auth.dependencies import get_current_user, require_admin
from app.modules.internal_api import router as router_module

# endpoints que solo usan la base, se atienden en hilos para que varios pedidos avancen a la vez
SYNC_ENDPOINTS = ['configure_project', 'escalate_interaction', 'discard_interaction', 'onboard_projects', 'list_countries', 'configure_categories', 'get_project_request_types', 'configure_priority_mapping', 'configure_spaces', 'get_indexing_status', 'get_metrics_summary', 'get_metrics_daily', 'get_metrics_by_category', 'get_metrics_confidence_distribution', 'get_metrics_heatmap', 'get_metrics_thresholds', 'list_onboarded_projects', 'get_project_configuration', 'get_itsm_connection', 'get_confluence_connection', 'get_llm_config_status', 'list_interactions', 'get_interaction_detail']
# endpoints que esperan servicios externos o redis, siguen siendo async
ASYNC_ENDPOINTS = ['approve_interaction', 'regenerate_interaction', 'configure_itsm_connection', 'list_available_projects', 'list_project_statuses', 'list_select_fields', 'list_field_options', 'configure_request_types', 'list_available_request_types', 'list_priorities', 'configure_confluence_connection', 'list_available_spaces', 'start_indexing', 'list_llm_models', 'save_llm_config']


# verifca que los endpoints que solo usan la base ya no son corrutinas
def test_database_only_endpoints_are_plain_functions():
    still_async = [name for name in SYNC_ENDPOINTS if inspect.iscoroutinefunction(getattr(router_module, name))]

    assert still_async == []


# verifica que los endpoints que esperan servicios externos siguen siendo async
def test_endpoints_that_await_external_services_stay_async():
    not_async = [name for name in ASYNC_ENDPOINTS if not inspect.iscoroutinefunction(getattr(router_module, name))]

    assert not_async == []


# verifica que la autenticacion consulta al usuario en un hilo distinto al del servidor
@pytest.mark.asyncio
async def test_get_current_user_reads_the_user_outside_the_event_loop_thread():
    loop_thread = threading.get_ident()
    seen = {}

    def fake_get_by_id(user_id):
        seen["thread"] = threading.get_ident()
        return SimpleNamespace(id=user_id, is_active=True, role="agent")

    credentials = SimpleNamespace(credentials="token-de-prueba")

    with patch.object(dependencies, "decode_token", return_value={"jti": "j1", "sub": "u1"}), \
         patch.object(dependencies, "is_denylisted", new=AsyncMock(return_value=False)), \
         patch.object(dependencies._app_user_repository, "get_by_id", side_effect=fake_get_by_id):
        user = await get_current_user(credentials)

    assert user.id == "u1"
    assert seen["thread"] != loop_thread


# verifica que cuatro pedidos lentos a la vez avanzan en paralelo, en serie tardarian 1.2 s
@pytest.mark.asyncio
async def test_concurrent_requests_are_served_in_parallel():
    def slow_status():
        time.sleep(0.3)
        return None

    fake_repository = MagicMock()
    fake_repository.get_latest_status.side_effect = slow_status
    app.dependency_overrides[require_admin] = lambda: SimpleNamespace(id="u1", role="admin")

    try:
        with patch.object(router_module, "_kb_indexing_status_repository", fake_repository):
            transport = httpx.ASGITransport(app=app)
            async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
                start = time.perf_counter()
                responses = await asyncio.gather(*[client.get("/api/indexing/status") for _ in range(4)])
                elapsed = time.perf_counter() - start
    finally:
        app.dependency_overrides.clear()

    assert all(response.status_code == 404 for response in responses)
    assert elapsed < 0.9


# verifica que el pool alcanza para los pedidos en paralelo de una pantalla del dashboard
def test_pool_is_big_enough_for_the_dashboard_requests():
    from app.core.database import engine

    assert engine.pool.size() >= 10
