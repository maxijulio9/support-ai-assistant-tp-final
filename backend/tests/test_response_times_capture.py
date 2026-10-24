"""Tests unitarios para el registro de los tiempos de respuesta.
Se mockean la base de datos, JSM y los servicios, sin tocar nada real."""

import pytest
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch, MagicMock, AsyncMock
from app.modules.interaction_logger.service import InteractionLogger
from app.modules.webhook_receiver.schemas import JsmWebhookPayload, NormalizedEvent
from app.modules.webhook_receiver.service import WebhookReceiver
from app.modules.event_pipeline.orchestrator import Orchestrator
from app.modules.event_pipeline.agent_resolution_repository import AgentResolutionRepository
from app.modules.internal_api.services.interaction_review_service import InteractionReviewService
from app.modules.ticket_analyzer.schemas import TicketAnalysis
from app.modules.response_generator.schemas import ACTION_AUTO_PUBLISH, ACTION_ESCALATE, ACTION_NEEDS_REVIEW, ACTION_REQUEST_INFO

LOGGER_DB = "app.modules.interaction_logger.service.get_db"
AGENT_DB = "app.modules.event_pipeline.agent_resolution_repository.get_db"
REVIEW_DB = "app.modules.internal_api.services.interaction_review_service.get_db"
RECEIVED = "2026-10-23T03:00:00+00:00"
JIRA_CREATED = "2026-10-23T00:00:00.000-0300"


# arma una base simulada y la deja como la proxima que entrega get_db
def _db(mock_get_db):
    db = MagicMock()
    mock_get_db.return_value = iter([db])
    return db


# verifica que se guardan la hora de entrada del evento y la de creacion del ticket, con la creacion solo la primera vez
@patch(LOGGER_DB)
def test_record_event_times_updates_the_event_and_the_ticket(mock_get_db):
    db = _db(mock_get_db)

    InteractionLogger().record_event_times("int-1", RECEIVED, JIRA_CREATED)

    event_sql, ticket_sql = [" ".join(str(call[0][0]).split()) for call in db.execute.call_args_list]
    event_params, ticket_params = [call[0][1] for call in db.execute.call_args_list]
    assert "UPDATE system_event SET received_at = :received_at" in event_sql
    assert event_params["received_at"] == datetime(2026, 10, 23, 3, 0, tzinfo=timezone.utc)
    assert "UPDATE ticket SET jira_created_at = COALESCE(jira_created_at, :jira_created_at)" in ticket_sql
    assert ticket_params["jira_created_at"] == datetime(2026, 10, 23, 3, 0, tzinfo=timezone.utc)
    db.commit.assert_called_once()


# verifca que la fecha de jsm, con la zona horaria sin dos puntos, se lee bien y se guarda en utc
@patch(LOGGER_DB)
def test_record_event_times_reads_the_jira_offset_format(mock_get_db):
    db = _db(mock_get_db)

    InteractionLogger().record_event_times("int-1", None, "2026-10-06T00:57:41.596-0300")

    params = db.execute.call_args[0][1]
    assert params["jira_created_at"] == datetime(2026, 10, 6, 3, 57, 41, 596000, tzinfo=timezone.utc)
    assert db.execute.call_count == 1


# verifica que sin id de interaccion, o sin ningun valor, ningun metodo toca la base
@patch(LOGGER_DB)
def test_the_methods_do_nothing_without_an_interaction_or_a_value(mock_get_db):
    logger_service = InteractionLogger()

    logger_service.record_event_times(None, RECEIVED, JIRA_CREATED)
    logger_service.record_event_times("int-1", None, None)
    logger_service.mark_first_response(None, True)
    logger_service.mark_resolved(None)
    logger_service.record_processing_time(None, 5)

    mock_get_db.assert_not_called()


# verifica que una fecha que no se puede leer se ignora sin tocar la base
@patch(LOGGER_DB)
def test_record_event_times_ignores_invalid_dates(mock_get_db):
    InteractionLogger().record_event_times("int-1", "no-es-una-fecha", "tampoco")

    mock_get_db.assert_not_called()


# verifica que un fallo de la base se registra, deshace y no interrumpe el pipeline
@patch(LOGGER_DB)
def test_a_database_failure_is_swallowed_and_rolled_back(mock_get_db):
    db = _db(mock_get_db)
    db.execute.side_effect = Exception("falla de bd")

    InteractionLogger().record_event_times("int-1", RECEIVED, JIRA_CREATED)

    db.rollback.assert_called_once()
    db.commit.assert_not_called()


# verifica que la primera respuesta se marca solo la primera vez y la resolucion solo si se pide
@patch(LOGGER_DB)
def test_mark_first_response_sets_the_first_response_and_optionally_the_resolution(mock_get_db):
    db = _db(mock_get_db)

    InteractionLogger().mark_first_response("int-1", resolved=True)

    sql = " ".join(str(db.execute.call_args[0][0]).split())
    assert "first_response_at = COALESCE(first_response_at, NOW())" in sql
    assert "resolved_at = CASE WHEN :resolved THEN COALESCE(resolved_at, NOW()) ELSE resolved_at END" in sql
    assert db.execute.call_args[0][1] == {"interaction_id": "int-1", "resolved": True}
    db.commit.assert_called_once()


# verifica que la resolucion se marca solo la primera vez
@patch(LOGGER_DB)
def test_mark_resolved_sets_the_resolution_once(mock_get_db):
    db = _db(mock_get_db)

    InteractionLogger().mark_resolved("int-1")

    assert "resolved_at = COALESCE(resolved_at, NOW())" in str(db.execute.call_args[0][0])
    db.commit.assert_called_once()


# verifica que el tiempo de procesamiento se guarda en milisegundos
@patch(LOGGER_DB)
def test_record_processing_time_saves_the_milliseconds(mock_get_db):
    db = _db(mock_get_db)

    InteractionLogger().record_processing_time("int-1", 1234)

    assert "processing_time_ms = :processing_time_ms" in str(db.execute.call_args[0][0])
    assert db.execute.call_args[0][1] == {"interaction_id": "int-1", "processing_time_ms": 1234}


# verifica que M1 registra la hora real de entrada, con zona horaria, y conserva la fecha de creacion de jsm
def test_normalize_payload_records_the_reception_time():
    payload = JsmWebhookPayload.model_validate({
        "webhookEvent": "jira:issue_created",
        "issue": {"id": "1", "key": "TEST-1", "fields": {"summary": "resumen", "created": JIRA_CREATED}},
    })

    event = WebhookReceiver().normalize_payload(payload)

    received = datetime.fromisoformat(event.received_at)
    assert received.tzinfo is not None
    assert abs((datetime.now(timezone.utc) - received).total_seconds()) < 5
    assert event.created_at == JIRA_CREATED


# verifica que M1 lleva la hora de entrada dentro del trabajo que encola
@pytest.mark.asyncio
async def test_dispatch_passes_the_reception_time_to_the_job():
    event = NormalizedEvent(issue_key="TEST-1", event_type="jira:issue_created", received_at=RECEIVED)
    pool = MagicMock()
    pool.enqueue_job = AsyncMock()

    with patch("app.modules.webhook_receiver.service.get_redis"), \
         patch("app.modules.webhook_receiver.service.get_arq_pool", new=AsyncMock(return_value=pool)):
        await WebhookReceiver().dispatch_event(event)

    args = pool.enqueue_job.await_args.args
    assert args[0] == "process_issue_created"
    assert args[1]["received_at"] == RECEIVED


# verifica que la tarea del worker le pasa la hora de entrada al orquestador
@pytest.mark.asyncio
async def test_worker_passes_the_reception_time_to_the_orchestrator():
    from app.modules.event_pipeline import worker as worker_module

    with patch.object(worker_module, "orchestrator") as mock_orchestrator:
        mock_orchestrator.process_event = AsyncMock(return_value={})
        await worker_module.process_issue_created({}, {"issue_key": "TEST-1", "event_type": "jira:issue_created", "received_at": RECEIVED})

    assert mock_orchestrator.process_event.await_args.args[0].received_at == RECEIVED


# arma un analisis de prueba, con los campos minimos
def _analysis(**overrides):
    values = {"issue_key": "TEST-1", "project_id": "proj-1", "summary": "resumen", "intent": "reporte_problema"}
    values.update(overrides)
    return TicketAnalysis(**values)


# arma el evento de entrada, con la hora de recepcion y la de creacion en jsm
def _event():
    return NormalizedEvent(issue_key="TEST-1", event_type="jira:issue_created", received_at=RECEIVED, created_at=JIRA_CREATED)


# arma la respuesta que devuelve M4, con la accion pedida
def _generated(action_type, response_text="respuesta"):
    generated = MagicMock()
    generated.action_type = action_type
    generated.response_text = response_text
    generated.confidence_score = 0.9
    generated.escalation_reason = "sin_contexto"
    generated.model_dump.return_value = {"action_type": action_type}
    return generated


# arma un orquestador sin construir sus dependencias, con todo simulado
def _orchestrator(analysis, generated=None, transition=("5", "Waiting for customer")):
    orchestrator = Orchestrator.__new__(Orchestrator)
    orchestrator.credentials_repository = MagicMock()
    orchestrator.credentials_repository.get_credentials.return_value = {"base_url": "https://x", "user_email": "a@b.c", "api_token": "t"}
    orchestrator.ticket_analyzer = MagicMock()
    orchestrator.ticket_analyzer.analyze = AsyncMock(return_value=analysis)
    orchestrator.ticket_analyzer.llm_client.generate_escalation_acknowledgment.return_value = "Hola, recibimos tu consulta"
    orchestrator.interaction_logger = MagicMock()
    orchestrator.interaction_logger.log_analysis.return_value = "int-1"
    orchestrator.knowledge_retriever = MagicMock()
    orchestrator.knowledge_retriever.retrieve.return_value = SimpleNamespace(chunks=[])
    orchestrator.response_generator = MagicMock()
    orchestrator.response_generator.generate.return_value = generated
    orchestrator._resolve_transition_id = AsyncMock(return_value=transition)
    return orchestrator


# corre el procesamiento de un evento con JSM simulado, y con un error al publicar si se pide
async def _run(orchestrator, publish_error=None):
    with patch("app.modules.event_pipeline.orchestrator.JsmExecutor") as jsm_class:
        jsm = jsm_class.return_value
        jsm.post_comment = AsyncMock(side_effect=publish_error)
        jsm.transition_issue = AsyncMock()
        await orchestrator.process_event(_event())
    return jsm


# verifica que una respuesta automatica registra las horas del evento, la primera respuesta, la resolucion y el tiempo de procesamiento
@pytest.mark.asyncio
async def test_auto_publish_records_the_times_the_first_response_and_the_resolution():
    orchestrator = _orchestrator(_analysis(), _generated(ACTION_AUTO_PUBLISH))

    await _run(orchestrator)

    logger_mock = orchestrator.interaction_logger
    logger_mock.record_event_times.assert_called_once_with("int-1", RECEIVED, JIRA_CREATED)
    logger_mock.mark_first_response.assert_called_once_with("int-1", resolved=True)
    processing = logger_mock.record_processing_time.call_args.args
    assert processing[0] == "int-1"
    assert isinstance(processing[1], int) and processing[1] >= 0


# verifica que pedir mas informacion cuenta como primera respuesta pero no resuelve la interaccion
@pytest.mark.asyncio
async def test_request_info_marks_the_first_response_without_resolving():
    orchestrator = _orchestrator(_analysis(), _generated(ACTION_REQUEST_INFO))

    await _run(orchestrator)

    orchestrator.interaction_logger.mark_first_response.assert_called_once_with("int-1", resolved=False)


# verifica que una nota interna para revision no cuenta como primera respuesta, porque el cliente no la ve
@pytest.mark.asyncio
async def test_needs_review_internal_note_does_not_mark_the_first_response():
    orchestrator = _orchestrator(_analysis(), _generated(ACTION_NEEDS_REVIEW))

    await _run(orchestrator)

    orchestrator.interaction_logger.mark_first_response.assert_not_called()
    orchestrator.interaction_logger.record_processing_time.assert_called_once()


# verifica que el acuse publico de un escalamiento cuenta como primera respuesta y no resuelve
@pytest.mark.asyncio
async def test_escalation_acknowledgment_marks_the_first_response_without_resolving():
    orchestrator = _orchestrator(_analysis(), _generated(ACTION_ESCALATE, None), transition=("3", "Escalated"))

    jsm = await _run(orchestrator)

    orchestrator.interaction_logger.mark_first_response.assert_called_once_with("int-1", resolved=False)
    assert jsm.post_comment.await_count == 2


# verifica que el escalamiento directo tambien marca la primera respuesta con su acuse publico
@pytest.mark.asyncio
async def test_direct_escalation_acknowledgment_marks_the_first_response():
    orchestrator = _orchestrator(_analysis(escalate_direct=True), transition=("3", "Escalated"))

    await _run(orchestrator)

    orchestrator.interaction_logger.mark_first_response.assert_called_once_with("int-1", resolved=False)
    orchestrator.interaction_logger.record_processing_time.assert_called_once()
    orchestrator.response_generator.generate.assert_not_called()


# verifica que el cierre de conversacion del cliente marca la resolucion y no cuenta como primera respuesta
@pytest.mark.asyncio
async def test_customer_closure_marks_the_resolution_only():
    orchestrator = _orchestrator(_analysis(intent="cierre_conversacion"), transition=("7", "Resolved"))

    await _run(orchestrator)

    orchestrator.interaction_logger.mark_resolved.assert_called_once_with("int-1")
    orchestrator.interaction_logger.mark_first_response.assert_not_called()


# verifica que si falla la publicacion en jsm no se marca la primera respuesta, pero si el tiempo de procesamiento
@pytest.mark.asyncio
async def test_a_failed_publication_does_not_mark_the_first_response():
    orchestrator = _orchestrator(_analysis(), _generated(ACTION_AUTO_PUBLISH))

    await _run(orchestrator, publish_error=Exception("jsm caido"))

    orchestrator.interaction_logger.mark_first_response.assert_not_called()
    orchestrator.interaction_logger.record_processing_time.assert_called_once()


# arma el servicio de revision sin construir sus dependencias, con un contexto de interaccion simulado
def _review_service():
    service = InteractionReviewService.__new__(InteractionReviewService)
    service.interaction_repository = MagicMock()
    service.interaction_repository.get_interaction_context.return_value = {
        "issue_key": "TEST-1", "project_id": "proj-1", "generated_response": "respuesta sugerida", "retrieval": MagicMock(),
        "threshold_auto_publish": 0.85, "threshold_needs_review": 0.6,
    }
    service.history = MagicMock()
    service.history.get = AsyncMock(return_value=[])
    service.response_generator = MagicMock()
    return service


# arma un JSM simulado que acepta comentarios
def _jsm():
    jsm = MagicMock()
    jsm.post_comment = AsyncMock()
    return jsm


# verifica que aprobar una sugerencia registra la primera respuesta y la resolucion
@pytest.mark.asyncio
async def test_approve_marks_the_response_and_the_resolution():
    service = _review_service()

    with patch.object(InteractionReviewService, "_get_jsm_executor", return_value=_jsm()), \
         patch.object(InteractionReviewService, "_update_interaction") as update, \
         patch.object(InteractionReviewService, "_claim_interaction"):
        await service.approve_interaction("int-1", "user-1")

    assert update.call_args.kwargs["responded"] is True


# verifica que regenerar con una respuesta que se publica registra la primera respuesta
@pytest.mark.asyncio
async def test_regenerate_that_publishes_marks_the_response():
    service = _review_service()
    service.response_generator.regenerate.return_value = SimpleNamespace(action_type=ACTION_AUTO_PUBLISH, response_text="nueva", confidence_score=0.9)

    with patch.object(InteractionReviewService, "_get_jsm_executor", return_value=_jsm()), \
         patch.object(InteractionReviewService, "_update_interaction") as update, \
         patch.object(InteractionReviewService, "_claim_interaction"):
        await service.regenerate_interaction("int-1", "motivo", "user-1")

    assert update.call_args.kwargs["responded"] is True


# verifica que regenerar con una respuesta que escala no registra la primera respuesta, porque no se publica nada
@pytest.mark.asyncio
async def test_regenerate_that_escalates_does_not_mark_the_response():
    service = _review_service()
    service.response_generator.regenerate.return_value = SimpleNamespace(action_type=ACTION_ESCALATE, response_text="nueva", confidence_score=0.2)
    jsm = _jsm()

    with patch.object(InteractionReviewService, "_get_jsm_executor", return_value=jsm), \
         patch.object(InteractionReviewService, "_update_interaction") as update, \
         patch.object(InteractionReviewService, "_claim_interaction"):
        await service.regenerate_interaction("int-1", "motivo", "user-1")

    assert update.call_args.kwargs["responded"] is False
    jsm.post_comment.assert_not_awaited()


# verifica que la actualizacion de la revision marca las horas solo cuando responded es verdadero, y por defecto no las marca
@patch(REVIEW_DB)
def test_update_interaction_marks_the_times_only_when_responded(mock_get_db):
    db = MagicMock()
    mock_get_db.side_effect = lambda: iter([db])
    service = _review_service()

    service._update_interaction("int-1", "AUTO_PUBLISH", "user-1", responded=True)
    sql = " ".join(str(db.execute.call_args[0][0]).split())
    assert "first_response_at = CASE WHEN :responded THEN COALESCE(first_response_at, NOW()) ELSE first_response_at END" in sql
    assert "resolved_at = CASE WHEN :responded THEN COALESCE(resolved_at, NOW()) ELSE resolved_at END" in sql
    assert db.execute.call_args[0][1]["responded"] is True

    service._update_interaction("int-1", "ESCALATE", "user-1")
    assert db.execute.call_args[0][1]["responded"] is False


# verifica que la resolucion externa registra la hora de resolucion
@patch(AGENT_DB)
def test_external_resolution_records_the_resolution_time(mock_get_db):
    db = _db(mock_get_db)
    db.execute.return_value.fetchone.return_value = SimpleNamespace(id="i-1")

    result = AgentResolutionRepository().discard_pending_interaction("TEST-1")

    update_sql = " ".join(str(db.execute.call_args_list[1][0][0]).split())
    assert result is True
    assert "resolved_at = COALESCE(resolved_at, NOW())" in update_sql


# verifica que la migracion versionada declara las tres columnas nuevas
def test_versioned_migration_declares_the_new_columns():
    migration = (Path(__file__).resolve().parents[2] / "db" / "migrations" / "01_create_relational_tables.sql").read_text()

    for column in ("first_response_at", "resolved_at", "jira_created_at"):
        assert column in migration
