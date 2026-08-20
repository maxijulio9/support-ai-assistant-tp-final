"""Tests unitarios para el Orchestrator del event_pipeline.
Mockea TicketAnalyzer, KnowledgeRetriever, InteractionLogger y ResponseGenerator,
ya que process_event los instancia a todos en el init."""

import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from app.modules.event_pipeline.orchestrator import Orchestrator
from app.modules.webhook_receiver.schemas import NormalizedEvent
from app.modules.ticket_analyzer.schemas import TicketAnalysis
from app.modules.knowledge_retriever.schemas import RetrievalResult, RetrievedChunk
from app.modules.response_generator.schemas import GeneratedResponse, ACTION_AUTO_PUBLISH, ACTION_RETRY


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