"""Tests unitarios para el Orchestrator del event_pipeline.
Mockea TicketAnalyzer, KnowledgeRetriever, InteractionLogger y ResponseGenerator,
ya que process_event los instancia a todos en el init."""

import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from app.modules.event_pipeline.orchestrator import Orchestrator
from app.modules.webhook_receiver.schemas import NormalizedEvent
from app.modules.ticket_analyzer.schemas import TicketAnalysis
from app.modules.knowledge_retriever.schemas import RetrievalResult, RetrievedChunk
from app.modules.response_generator.schemas import (
    GeneratedResponse,
    ACTION_AUTO_PUBLISH,
    ACTION_NEEDS_REVIEW,
    ACTION_ESCALATE,
    ACTION_RETRY,
)


def _build_event(issue_key="TEST-1") -> NormalizedEvent:
    return NormalizedEvent(issue_key=issue_key, event_type="jira:issue_created", summary="consulta de prueba")


def _build_analysis(issue_key="TEST-1") -> TicketAnalysis:
    return TicketAnalysis(issue_key=issue_key, event_type="issue_created", scope="IN_SCOPE", resolved_by="L1", info_sufficient=True)


def _build_retrieval(issue_key="TEST-1") -> RetrievalResult:
    return RetrievalResult(issue_key=issue_key, chunks=[RetrievedChunk(chunk_id="1", content="contenido de ejemplo", similarity_score=0.5)])


# verifica que generate() se llama despues de retrieve(), con el analysis y retrieval correctos
@patch("app.modules.event_pipeline.orchestrator.ResponseGenerator")
@patch("app.modules.event_pipeline.orchestrator.KnowledgeRetriever")
@patch("app.modules.event_pipeline.orchestrator.InteractionLogger")
@patch("app.modules.event_pipeline.orchestrator.TicketAnalyzer")
@pytest.mark.asyncio
async def test_calls_generate_with_analysis_and_retrieval(mock_analyzer_class, mock_logger_class, mock_retriever_class, mock_generator_class):
    analysis = _build_analysis()
    retrieval = _build_retrieval()
    generated = GeneratedResponse(issue_key="TEST-1", action_type=ACTION_AUTO_PUBLISH, response_text="respuesta")

    mock_analyzer = MagicMock()
    mock_analyzer.analyze = AsyncMock(return_value=analysis)
    mock_analyzer_class.return_value = mock_analyzer

    mock_retriever = MagicMock()
    mock_retriever.retrieve.return_value = retrieval
    mock_retriever_class.return_value = mock_retriever

    mock_generator = MagicMock()
    mock_generator.generate.return_value = generated
    mock_generator_class.return_value = mock_generator
    mock_logger_class.return_value = MagicMock()

    orchestrator = Orchestrator()
    result = await orchestrator.process_event(_build_event())

    mock_generator.generate.assert_called_once_with(analysis, retrieval)
    assert result["generated_response"]["action_type"] == ACTION_AUTO_PUBLISH


# verifica que el caso retry hoy solo logea, sin ejecutar ningun reintento real
@patch("app.modules.event_pipeline.orchestrator.ResponseGenerator")
@patch("app.modules.event_pipeline.orchestrator.KnowledgeRetriever")
@patch("app.modules.event_pipeline.orchestrator.InteractionLogger")
@patch("app.modules.event_pipeline.orchestrator.TicketAnalyzer")
@pytest.mark.asyncio
async def test_logs_warning_when_action_type_is_retry(mock_analyzer_class, mock_logger_class, mock_retriever_class, mock_generator_class, caplog):
    analysis = _build_analysis()
    retrieval = _build_retrieval()
    generated = GeneratedResponse(issue_key="TEST-1", action_type=ACTION_RETRY)

    mock_analyzer = MagicMock()
    mock_analyzer.analyze = AsyncMock(return_value=analysis)
    mock_analyzer_class.return_value = mock_analyzer

    mock_retriever = MagicMock()
    mock_retriever.retrieve.return_value = retrieval
    mock_retriever_class.return_value = mock_retriever

    mock_generator = MagicMock()
    mock_generator.generate.return_value = generated
    mock_generator_class.return_value = mock_generator
    mock_logger_class.return_value = MagicMock()

    orchestrator = Orchestrator()

    with caplog.at_level("WARNING"):
        result = await orchestrator.process_event(_build_event())

    assert result["generated_response"]["action_type"] == ACTION_RETRY
    mock_retriever.retrieve.assert_called_once()
    assert any("retry" in record.message.lower() for record in caplog.records)
    
    
# verifica que auto_publish publica el comentario como publico
@patch("app.modules.event_pipeline.orchestrator.JsmExecutor")
@patch("app.modules.event_pipeline.orchestrator.ResponseGenerator")
@patch("app.modules.event_pipeline.orchestrator.KnowledgeRetriever")
@patch("app.modules.event_pipeline.orchestrator.InteractionLogger")
@patch("app.modules.event_pipeline.orchestrator.TicketAnalyzer")
@pytest.mark.asyncio
async def test_publishes_public_comment_when_auto_publish(mock_analyzer_class, mock_logger_class, mock_retriever_class, mock_generator_class, mock_jsm_class):
    analysis = _build_analysis()
    retrieval = _build_retrieval()
    generated = GeneratedResponse(issue_key="TEST-1", action_type=ACTION_AUTO_PUBLISH, response_text="respuesta al cliente")

    mock_analyzer = MagicMock()
    mock_analyzer.analyze = AsyncMock(return_value=analysis)
    mock_analyzer_class.return_value = mock_analyzer
    mock_retriever_class.return_value = MagicMock(retrieve=MagicMock(return_value=retrieval))
    mock_generator_class.return_value = MagicMock(generate=MagicMock(return_value=generated))
    mock_logger_class.return_value = MagicMock()
    mock_jsm = MagicMock()
    mock_jsm_class.return_value = mock_jsm

    orchestrator = Orchestrator()
    await orchestrator.process_event(_build_event())

    mock_jsm.post_comment.assert_called_once_with("TEST-1", "respuesta al cliente", public=True)


# verifica que needs_review publica el comentario como nota interna
@patch("app.modules.event_pipeline.orchestrator.JsmExecutor")
@patch("app.modules.event_pipeline.orchestrator.ResponseGenerator")
@patch("app.modules.event_pipeline.orchestrator.KnowledgeRetriever")
@patch("app.modules.event_pipeline.orchestrator.InteractionLogger")
@patch("app.modules.event_pipeline.orchestrator.TicketAnalyzer")
@pytest.mark.asyncio
async def test_publishes_internal_note_when_needs_review(mock_analyzer_class, mock_logger_class, mock_retriever_class, mock_generator_class, mock_jsm_class):
    analysis = _build_analysis()
    retrieval = _build_retrieval()
    generated = GeneratedResponse(issue_key="TEST-1", action_type=ACTION_NEEDS_REVIEW, response_text="respuesta para revisar")

    mock_analyzer = MagicMock()
    mock_analyzer.analyze = AsyncMock(return_value=analysis)
    mock_analyzer_class.return_value = mock_analyzer
    mock_retriever_class.return_value = MagicMock(retrieve=MagicMock(return_value=retrieval))
    mock_generator_class.return_value = MagicMock(generate=MagicMock(return_value=generated))
    mock_logger_class.return_value = MagicMock()
    mock_jsm = MagicMock()
    mock_jsm_class.return_value = mock_jsm

    orchestrator = Orchestrator()
    await orchestrator.process_event(_build_event())

    mock_jsm.post_comment.assert_called_once_with("TEST-1", "respuesta para revisar", public=False)


# verifica que escalate no publica ningun comentario, solo logea
@patch("app.modules.event_pipeline.orchestrator.JsmExecutor")
@patch("app.modules.event_pipeline.orchestrator.ResponseGenerator")
@patch("app.modules.event_pipeline.orchestrator.KnowledgeRetriever")
@patch("app.modules.event_pipeline.orchestrator.InteractionLogger")
@patch("app.modules.event_pipeline.orchestrator.TicketAnalyzer")
@pytest.mark.asyncio
async def test_does_not_publish_comment_when_escalate(mock_analyzer_class, mock_logger_class, mock_retriever_class, mock_generator_class, mock_jsm_class):
    analysis = _build_analysis()
    retrieval = _build_retrieval()
    generated = GeneratedResponse(issue_key="TEST-1", action_type=ACTION_ESCALATE)

    mock_analyzer = MagicMock()
    mock_analyzer.analyze = AsyncMock(return_value=analysis)
    mock_analyzer_class.return_value = mock_analyzer
    mock_retriever_class.return_value = MagicMock(retrieve=MagicMock(return_value=retrieval))
    mock_generator_class.return_value = MagicMock(generate=MagicMock(return_value=generated))
    mock_logger_class.return_value = MagicMock()
    mock_jsm = MagicMock()
    mock_jsm_class.return_value = mock_jsm

    orchestrator = Orchestrator()
    await orchestrator.process_event(_build_event())

    mock_jsm.post_comment.assert_not_called()


# verifica que si post_comment falla, no rompe todo el process_event
@patch("app.modules.event_pipeline.orchestrator.JsmExecutor")
@patch("app.modules.event_pipeline.orchestrator.ResponseGenerator")
@patch("app.modules.event_pipeline.orchestrator.KnowledgeRetriever")
@patch("app.modules.event_pipeline.orchestrator.InteractionLogger")
@patch("app.modules.event_pipeline.orchestrator.TicketAnalyzer")
@pytest.mark.asyncio
async def test_does_not_crash_when_post_comment_fails(mock_analyzer_class, mock_logger_class, mock_retriever_class, mock_generator_class, mock_jsm_class):
    analysis = _build_analysis()
    retrieval = _build_retrieval()
    generated = GeneratedResponse(issue_key="TEST-1", action_type=ACTION_AUTO_PUBLISH, response_text="respuesta")

    mock_analyzer = MagicMock()
    mock_analyzer.analyze = AsyncMock(return_value=analysis)
    mock_analyzer_class.return_value = mock_analyzer
    mock_retriever_class.return_value = MagicMock(retrieve=MagicMock(return_value=retrieval))
    mock_generator_class.return_value = MagicMock(generate=MagicMock(return_value=generated))
    mock_logger_class.return_value = MagicMock()
    mock_jsm = MagicMock()
    mock_jsm.post_comment.side_effect = Exception("jsm no responde")
    mock_jsm_class.return_value = mock_jsm

    orchestrator = Orchestrator()
    result = await orchestrator.process_event(_build_event())

    assert result["status"] == "processed"
    
# verifica que si escalate_direct es true, se salta m3 y m4 por completo
@patch("app.modules.event_pipeline.orchestrator.ResponseGenerator")
@patch("app.modules.event_pipeline.orchestrator.KnowledgeRetriever")
@patch("app.modules.event_pipeline.orchestrator.InteractionLogger")
@patch("app.modules.event_pipeline.orchestrator.TicketAnalyzer")
@pytest.mark.asyncio
async def test_skips_m3_and_m4_when_escalate_direct(mock_analyzer_class, mock_logger_class, mock_retriever_class, mock_generator_class):
    analysis = TicketAnalysis(issue_key="TEST-1", event_type="issue_created", scope="OUT_OF_SCOPE", escalate_direct=True)

    mock_analyzer = MagicMock()
    mock_analyzer.analyze = AsyncMock(return_value=analysis)
    mock_analyzer_class.return_value = mock_analyzer

    mock_retriever = MagicMock()
    mock_retriever_class.return_value = mock_retriever

    mock_generator = MagicMock()
    mock_generator_class.return_value = mock_generator

    mock_logger_class.return_value = MagicMock()

    orchestrator = Orchestrator()
    result = await orchestrator.process_event(_build_event())

    assert result["generated_response"]["action_type"] == ACTION_ESCALATE
    mock_retriever.retrieve.assert_not_called()
    mock_generator.generate.assert_not_called()


# verifica que escalate resuelve el transition_id real y llama a transition_issue
@patch("app.modules.event_pipeline.orchestrator.get_db")
@patch("app.modules.event_pipeline.orchestrator.JsmExecutor")
@patch("app.modules.event_pipeline.orchestrator.ResponseGenerator")
@patch("app.modules.event_pipeline.orchestrator.KnowledgeRetriever")
@patch("app.modules.event_pipeline.orchestrator.InteractionLogger")
@patch("app.modules.event_pipeline.orchestrator.TicketAnalyzer")
@pytest.mark.asyncio
async def test_escalate_resolves_transition_id_and_transitions(mock_analyzer_class, mock_logger_class, mock_retriever_class, mock_generator_class, mock_jsm_class, mock_get_db):
    analysis = _build_analysis()
    retrieval = _build_retrieval()
    generated = GeneratedResponse(issue_key="TEST-1", action_type=ACTION_ESCALATE)

    mock_analyzer = MagicMock()
    mock_analyzer.analyze = AsyncMock(return_value=analysis)
    mock_analyzer_class.return_value = mock_analyzer
    mock_retriever_class.return_value = MagicMock(retrieve=MagicMock(return_value=retrieval))
    mock_generator_class.return_value = MagicMock(generate=MagicMock(return_value=generated))
    mock_logger_class.return_value = MagicMock()

    mock_db = MagicMock()
    mock_row = MagicMock()
    mock_row.name = "Escalated"
    mock_db.execute.return_value.fetchone.return_value = mock_row
    mock_get_db.return_value = iter([mock_db])

    mock_jsm = MagicMock()
    mock_jsm.get_transitions = AsyncMock(return_value={"transitions": [{"id": "3", "to": {"name": "Escalated"}}]})
    mock_jsm.transition_issue = AsyncMock(return_value=True)
    mock_jsm_class.return_value = mock_jsm

    orchestrator = Orchestrator()
    await orchestrator.process_event(_build_event())

    mock_jsm.transition_issue.assert_called_once_with("TEST-1", "3")


# verifica que si no hay mapeo configurado, no se llama a transition_issue
@patch("app.modules.event_pipeline.orchestrator.get_db")
@patch("app.modules.event_pipeline.orchestrator.JsmExecutor")
@patch("app.modules.event_pipeline.orchestrator.ResponseGenerator")
@patch("app.modules.event_pipeline.orchestrator.KnowledgeRetriever")
@patch("app.modules.event_pipeline.orchestrator.InteractionLogger")
@patch("app.modules.event_pipeline.orchestrator.TicketAnalyzer")
@pytest.mark.asyncio
async def test_escalate_does_not_transition_when_no_mapping_configured(mock_analyzer_class, mock_logger_class, mock_retriever_class, mock_generator_class, mock_jsm_class, mock_get_db):
    analysis = _build_analysis()
    retrieval = _build_retrieval()
    generated = GeneratedResponse(issue_key="TEST-1", action_type=ACTION_ESCALATE)

    mock_analyzer = MagicMock()
    mock_analyzer.analyze = AsyncMock(return_value=analysis)
    mock_analyzer_class.return_value = mock_analyzer
    mock_retriever_class.return_value = MagicMock(retrieve=MagicMock(return_value=retrieval))
    mock_generator_class.return_value = MagicMock(generate=MagicMock(return_value=generated))
    mock_logger_class.return_value = MagicMock()

    mock_db = MagicMock()
    mock_db.execute.return_value.fetchone.return_value = None
    mock_get_db.return_value = iter([mock_db])

    mock_jsm = MagicMock()
    mock_jsm.transition_issue = AsyncMock()
    mock_jsm_class.return_value = mock_jsm

    orchestrator = Orchestrator()
    await orchestrator.process_event(_build_event())

    mock_jsm.transition_issue.assert_not_called()
    

# verifica que aunque escale directo, la interaccion queda registrada en la bd
@patch("app.modules.event_pipeline.orchestrator.ResponseGenerator")
@patch("app.modules.event_pipeline.orchestrator.KnowledgeRetriever")
@patch("app.modules.event_pipeline.orchestrator.InteractionLogger")
@patch("app.modules.event_pipeline.orchestrator.TicketAnalyzer")
@pytest.mark.asyncio
async def test_logs_analysis_even_when_escalate_direct(mock_analyzer_class, mock_logger_class, mock_retriever_class, mock_generator_class):
    analysis = TicketAnalysis(issue_key="TEST-1", event_type="issue_created", scope="OUT_OF_SCOPE", escalate_direct=True)

    mock_analyzer = MagicMock()
    mock_analyzer.analyze = AsyncMock(return_value=analysis)
    mock_analyzer_class.return_value = mock_analyzer

    mock_retriever_class.return_value = MagicMock()
    mock_generator_class.return_value = MagicMock()

    mock_logger = MagicMock()
    mock_logger_class.return_value = mock_logger

    orchestrator = Orchestrator()
    await orchestrator.process_event(_build_event())

    mock_logger.log_analysis.assert_called_once_with(analysis)