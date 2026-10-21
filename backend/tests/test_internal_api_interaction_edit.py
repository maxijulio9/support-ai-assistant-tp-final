"""Tests unitarios para editar la respuesta sugerida antes de aprobarla.
Se mockean la base de datos, JSM y los servicios, sin tocar nada real."""

import pytest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.main import app as main_app
from app.modules.auth.dependencies import get_current_user
from app.modules.internal_api.router import router
from app.modules.internal_api.repositories.interaction_listing_repository import InteractionListingRepository
from app.modules.internal_api.services.interaction_review_service import (
    InteractionReviewService,
    InvalidEditedResponseError,
    MAX_EDITED_RESPONSE_LENGTH,
)

SERVICE_DB = "app.modules.internal_api.services.interaction_review_service.get_db"
LISTING_DB = "app.modules.internal_api.repositories.interaction_listing_repository.get_db"
ROUTER_SERVICE = "app.modules.internal_api.router._review_service"
GENERATED = "respuesta sugerida por el sistema"

app = FastAPI()
app.include_router(router)
client = TestClient(app)


# arma el servicio con el repositorio de interacciones simulado y un JSM simulado
def _build_service():
    service = InteractionReviewService.__new__(InteractionReviewService)
    service.interaction_repository = MagicMock()
    service.interaction_repository.get_interaction_context.return_value = {"issue_key": "TEST-1", "generated_response": GENERATED}
    jsm = MagicMock()
    jsm.post_comment = AsyncMock()
    return service, jsm


# hace que el endpoint vea a un usuario autenticado
def _as_agent():
    app.dependency_overrides[get_current_user] = lambda: MagicMock(id="user-1", role="agent")


# arma una fila simulada del listado o del detalle
def _listing_row(**overrides):
    values = {
        "id": "i-1", "issue_key": "TEST-1", "summary": "resumen", "category": "Acceso", "priority": "High",
        "decision": "AUTO_PUBLISH", "system_decision": "NEEDS_REVIEW", "resolution_channel": "REVIEWED_EDITED",
        "confidence_score": 0.9, "text_input": "texto", "generated_response": GENERATED, "edited_response": None,
        "created_at": datetime(2026, 10, 20, 12, 0, tzinfo=timezone.utc),
    }
    values.update(overrides)
    row = MagicMock()
    for key, value in values.items():
        setattr(row, key, value)
    return row


# arma el resultado simulado de una consulta
def _result(one=None, rows=None):
    result = MagicMock()
    result.fetchone.return_value = one
    result.fetchall.return_value = rows or []
    return result


# verifica que aprobar sin edicion publica la respuesta generada y no guarda ningun texto editado
@patch(SERVICE_DB)
@pytest.mark.asyncio
async def test_approve_without_edit_publishes_the_generated_response(mock_get_db):
    mock_db = MagicMock()
    mock_get_db.return_value = iter([mock_db])
    service, jsm = _build_service()

    with patch.object(InteractionReviewService, "_get_jsm_executor", return_value=jsm):
        result = await service.approve_interaction("int-1", "user-1")

    assert result == "AUTO_PUBLISH"
    jsm.post_comment.assert_awaited_once_with("TEST-1", GENERATED, public=True)
    params = mock_db.execute.call_args[0][1]
    assert params["resolution_channel"] == "REVIEWED_APPROVED"
    assert params["edited_response"] is None


# verifica que aprobar con un texto editado publica ese texto recortado, lo guarda y registra el canal REVIEWED_EDITED
@patch(SERVICE_DB)
@pytest.mark.asyncio
async def test_approve_with_edit_publishes_the_edited_text_and_records_it(mock_get_db):
    mock_db = MagicMock()
    mock_get_db.return_value = iter([mock_db])
    service, jsm = _build_service()

    with patch.object(InteractionReviewService, "_get_jsm_executor", return_value=jsm):
        await service.approve_interaction("int-1", "user-1", "  Hola, version final.  ")

    jsm.post_comment.assert_awaited_once_with("TEST-1", "Hola, version final.", public=True)
    params = mock_db.execute.call_args[0][1]
    assert params["resolution_channel"] == "REVIEWED_EDITED"
    assert params["edited_response"] == "Hola, version final."
    assert params["generated_response"] is None


# verifica que un texto editado igual al generado se trata como una aprobacion comun
@patch(SERVICE_DB)
@pytest.mark.asyncio
async def test_approve_with_an_identical_text_is_a_plain_approval(mock_get_db):
    mock_db = MagicMock()
    mock_get_db.return_value = iter([mock_db])
    service, jsm = _build_service()

    with patch.object(InteractionReviewService, "_get_jsm_executor", return_value=jsm):
        await service.approve_interaction("int-1", "user-1", "  " + GENERATED + "  ")

    jsm.post_comment.assert_awaited_once_with("TEST-1", GENERATED, public=True)
    params = mock_db.execute.call_args[0][1]
    assert params["resolution_channel"] == "REVIEWED_APPROVED"
    assert params["edited_response"] is None


# verifica que un texto vacio despues de recortar se rechaza antes de leer la base o llamar a JSM
@patch(SERVICE_DB)
@pytest.mark.asyncio
async def test_approve_with_an_empty_text_is_rejected_before_any_call(mock_get_db):
    service, jsm = _build_service()

    with patch.object(InteractionReviewService, "_get_jsm_executor", return_value=jsm):
        with pytest.raises(InvalidEditedResponseError, match="vacia"):
            await service.approve_interaction("int-1", "user-1", "   ")

    service.interaction_repository.get_interaction_context.assert_not_called()
    mock_get_db.assert_not_called()
    jsm.post_comment.assert_not_awaited()


# verifica que un texto de mas de 5000 caracteres se rechaza con el maximo en el mensaje
@patch(SERVICE_DB)
@pytest.mark.asyncio
async def test_approve_with_a_text_over_the_limit_is_rejected(mock_get_db):
    service, jsm = _build_service()

    with patch.object(InteractionReviewService, "_get_jsm_executor", return_value=jsm):
        with pytest.raises(InvalidEditedResponseError, match="5000"):
            await service.approve_interaction("int-1", "user-1", "x" * (MAX_EDITED_RESPONSE_LENGTH + 1))

    jsm.post_comment.assert_not_awaited()


# verifca que un texto de exactamente 5000 caracteres se acepta
@patch(SERVICE_DB)
@pytest.mark.asyncio
async def test_approve_with_a_text_of_exactly_the_limit_is_accepted(mock_get_db):
    mock_db = MagicMock()
    mock_get_db.return_value = iter([mock_db])
    service, jsm = _build_service()

    with patch.object(InteractionReviewService, "_get_jsm_executor", return_value=jsm):
        await service.approve_interaction("int-1", "user-1", "x" * MAX_EDITED_RESPONSE_LENGTH)

    assert len(mock_db.execute.call_args[0][1]["edited_response"]) == MAX_EDITED_RESPONSE_LENGTH


# verifica que si la interaccion no existe se lanza ValueError y no se publica nada
@patch(SERVICE_DB)
@pytest.mark.asyncio
async def test_approve_with_edit_on_an_unknown_interaction_raises_value_error(mock_get_db):
    service, jsm = _build_service()
    service.interaction_repository.get_interaction_context.return_value = None

    with patch.object(InteractionReviewService, "_get_jsm_executor", return_value=jsm):
        with pytest.raises(ValueError, match="no encontrada"):
            await service.approve_interaction("int-x", "user-1", "texto")

    jsm.post_comment.assert_not_awaited()


# verifica que el endpoint le pasa el texto editado al servicio
@patch(ROUTER_SERVICE)
def test_endpoint_passes_the_edited_text_to_the_service(mock_service):
    mock_service.approve_interaction = AsyncMock(return_value="AUTO_PUBLISH")
    _as_agent()

    response = client.post("/api/interactions/int-1/approve", json={"reviewed_by": "agent-1", "edited_response": "texto"})

    app.dependency_overrides.clear()

    assert response.status_code == 200
    mock_service.approve_interaction.assert_awaited_once_with("int-1", "agent-1", "texto")


# verifica que sin texto editado el endpoint llama al servicio como antes
@patch(ROUTER_SERVICE)
def test_endpoint_without_an_edit_keeps_the_previous_call(mock_service):
    mock_service.approve_interaction = AsyncMock(return_value="AUTO_PUBLISH")
    _as_agent()

    response = client.post("/api/interactions/int-1/approve", json={"reviewed_by": "agent-1"})

    app.dependency_overrides.clear()

    assert response.status_code == 200
    mock_service.approve_interaction.assert_awaited_once_with("int-1", "agent-1")


# verifica que un texto editado invalido se traduce en HTTP 400 con el mensaje en texto legible
@patch(ROUTER_SERVICE)
def test_endpoint_invalid_edited_text_returns_400_with_a_readable_detail(mock_service):
    mock_service.approve_interaction = AsyncMock(side_effect=InvalidEditedResponseError("La respuesta editada no puede estar vacia"))
    _as_agent()

    response = client.post("/api/interactions/int-1/approve", json={"edited_response": "   "})

    app.dependency_overrides.clear()

    assert response.status_code == 400
    assert response.json()["detail"] == "La respuesta editada no puede estar vacia"


# verifica que una interaccion inexistente sigue respondiendo 404 aunque venga un texto editado
@patch(ROUTER_SERVICE)
def test_endpoint_unknown_interaction_with_an_edit_still_returns_404(mock_service):
    mock_service.approve_interaction = AsyncMock(side_effect=ValueError("interaction 'int-x' no encontrada"))
    _as_agent()

    response = client.post("/api/interactions/int-x/approve", json={"edited_response": "texto"})

    app.dependency_overrides.clear()

    assert response.status_code == 404


# verifica que el listado marca como editadas solo las interacciones con texto editado
@patch(LISTING_DB)
def test_listing_marks_edited_interactions(mock_get_db):
    mock_db = MagicMock()
    mock_get_db.return_value = iter([mock_db])
    mock_db.execute.return_value.fetchall.return_value = [
        _listing_row(edited_response="texto editado"),
        _listing_row(edited_response=None),
    ]

    result = InteractionListingRepository().list_interactions()

    assert [item["was_edited"] for item in result] == [True, False]


# verifica que el detalle trae el texto editado y la respuesta original por separado
@patch(LISTING_DB)
def test_detail_returns_the_edited_text_and_keeps_the_original(mock_get_db):
    mock_db = MagicMock()
    mock_get_db.return_value = iter([mock_db])
    mock_db.execute.side_effect = [_result(one=_listing_row(edited_response="texto editado")), _result(rows=[])]

    detail = InteractionListingRepository().get_detail("i-1")

    assert detail["edited_response"] == "texto editado"
    assert detail["was_edited"] is True
    assert detail["generated_response"] == GENERATED


# verifica que el detalle de una interaccion sin edicion trae edited_response en null y was_edited en false
@patch(LISTING_DB)
def test_detail_of_an_unedited_interaction(mock_get_db):
    mock_db = MagicMock()
    mock_get_db.return_value = iter([mock_db])
    mock_db.execute.side_effect = [_result(one=_listing_row()), _result(rows=[])]

    detail = InteractionListingRepository().get_detail("i-1")

    assert detail["edited_response"] is None
    assert detail["was_edited"] is False


# verifica en el contrato que edited_response es opcional al aprobar y que was_edited es obligatorio en la respuesta
def test_contract_declares_the_edit_fields():
    schemas = main_app.openapi()["components"]["schemas"]

    assert "edited_response" in schemas["ApproveRequest"]["properties"]
    assert "edited_response" not in schemas["ApproveRequest"].get("required", [])
    assert "was_edited" in schemas["InteractionListItem"]["required"]
    assert schemas["InteractionListItem"]["properties"]["was_edited"]["type"] == "boolean"
    assert "was_edited" in schemas["InteractionDetailResponse"]["required"]
    assert "edited_response" in schemas["InteractionDetailResponse"]["properties"]


# verifica que la migracion versionada declara la columna edited_response en la tabla interaction
def test_versioned_migration_declares_the_edited_response_column():
    migration = Path(__file__).resolve().parents[2] / "db" / "migrations" / "01_create_relational_tables.sql"

    assert "edited_response" in migration.read_text()
