"""Tests unitarios para el Modulo 2 - TicketAnalyzer.
Se mockean LlmClient, ConversationHistory y ProjectRepository para no depender de OpenAI, Redis ni la bd real."""

import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from app.modules.ticket_analyzer.service import TicketAnalyzer
from app.modules.ticket_analyzer.schemas import ClassificationResult, ProjectContext
from app.modules.webhook_receiver.schemas import NormalizedEvent


# arma un NormalizedEvent basico para usar en los tests
def _build_event(issue_key: str = "TARG-10") -> NormalizedEvent:
    return NormalizedEvent(
        issue_key=issue_key,
        event_type="jira:issue_created",
        summary="no puedo iniciar sesion en la plataforma",
    )


# arma un ClassificationResult con el resolved_by que se le pase
def _build_classification(resolved_by: str) -> ClassificationResult:
    return ClassificationResult(
        intent="reporte_problema",
        category="acceso_autenticacion",
        resolved_by=resolved_by,
        scope="IN_SCOPE",
        sentiment="negativo",
        impact="Medium",
        urgency="Medium",
    )


# arma un ProjectContext basico para usar en los tests
def _build_project_context(**overrides) -> ProjectContext:
    defaults = {
        "project_id": "proj-1",
        "country": "AR",
        "categories": ["acceso_autenticacion", "seguridad_cuenta"],
    }
    defaults.update(overrides)
    return ProjectContext(**defaults)


# verifica que info_sufficient es False cuando el llm devuelve MISSING_INFO
@patch("app.modules.ticket_analyzer.service.ProjectRepository")
@patch("app.modules.ticket_analyzer.service.ConversationHistory")
@patch("app.modules.ticket_analyzer.service.LlmClient")
@pytest.mark.asyncio
async def test_info_sufficient_false_cuando_falta_info(mock_llm_class, mock_history_class, mock_repo_class):
    mock_history = MagicMock()
    mock_history.append = AsyncMock()
    mock_history.get = AsyncMock(return_value=[])
    mock_history_class.return_value = mock_history

    mock_llm = MagicMock()
    mock_llm.classify.return_value = _build_classification("MISSING_INFO")
    mock_llm_class.return_value = mock_llm

    mock_repo = MagicMock()
    mock_repo.get_project_context.return_value = _build_project_context()
    mock_repo_class.return_value = mock_repo

    analyzer = TicketAnalyzer()
    result = await analyzer.analyze(_build_event())

    assert result.info_sufficient is False
    assert result.resolved_by == "MISSING_INFO"


# verifica que info_sufficient es True cuando el llm devuelve L1
@patch("app.modules.ticket_analyzer.service.ProjectRepository")
@patch("app.modules.ticket_analyzer.service.ConversationHistory")
@patch("app.modules.ticket_analyzer.service.LlmClient")
@pytest.mark.asyncio
async def test_info_sufficient_true_cuando_resuelve_l1(mock_llm_class, mock_history_class, mock_repo_class):
    mock_history = MagicMock()
    mock_history.append = AsyncMock()
    mock_history.get = AsyncMock(return_value=[])
    mock_history_class.return_value = mock_history

    mock_llm = MagicMock()
    mock_llm.classify.return_value = _build_classification("L1")
    mock_llm_class.return_value = mock_llm

    mock_repo = MagicMock()
    mock_repo.get_project_context.return_value = _build_project_context()
    mock_repo_class.return_value = mock_repo

    analyzer = TicketAnalyzer()
    result = await analyzer.analyze(_build_event())

    assert result.info_sufficient is True
    assert result.resolved_by == "L1"


# verifica que info_sufficient es True por defecto si el llm no puede clasificar
@patch("app.modules.ticket_analyzer.service.ProjectRepository")
@patch("app.modules.ticket_analyzer.service.ConversationHistory")
@patch("app.modules.ticket_analyzer.service.LlmClient")
@pytest.mark.asyncio
async def test_info_sufficient_true_por_defecto_si_falla_llm(mock_llm_class, mock_history_class, mock_repo_class):
    mock_history = MagicMock()
    mock_history.append = AsyncMock()
    mock_history.get = AsyncMock(return_value=[])
    mock_history_class.return_value = mock_history

    mock_llm = MagicMock()
    mock_llm.classify.return_value = None
    mock_llm_class.return_value = mock_llm

    mock_repo = MagicMock()
    mock_repo.get_project_context.return_value = _build_project_context()
    mock_repo_class.return_value = mock_repo

    analyzer = TicketAnalyzer()
    result = await analyzer.analyze(_build_event())

    assert result.info_sufficient is True