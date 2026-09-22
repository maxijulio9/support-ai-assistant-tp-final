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
        "threshold_auto_publish": 0.85,
        "threshold_needs_review": 0.60,
        "similarity_threshold": 0.40,

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
    
# verifica que escalate_direct es True cuando el scope esta fuera de alcance
@patch("app.modules.ticket_analyzer.service.ProjectRepository")
@patch("app.modules.ticket_analyzer.service.ConversationHistory")
@patch("app.modules.ticket_analyzer.service.LlmClient")
@pytest.mark.asyncio
async def test_escalate_direct_true_cuando_out_of_scope(mock_llm_class, mock_history_class, mock_repo_class):
    mock_history = MagicMock()
    mock_history.append = AsyncMock()
    mock_history.get = AsyncMock(return_value=[])
    mock_history_class.return_value = mock_history

    mock_llm = MagicMock()
    mock_llm.classify.return_value = _build_classification("L1")
    mock_llm.classify.return_value.scope = "OUT_OF_SCOPE"
    mock_llm_class.return_value = mock_llm

    mock_repo = MagicMock()
    mock_repo.get_project_context.return_value = _build_project_context()
    mock_repo_class.return_value = mock_repo

    analyzer = TicketAnalyzer()
    result = await analyzer.analyze(_build_event())

    assert result.escalate_direct is True


# verifica que escalate_direct es False en el camino normal
@patch("app.modules.ticket_analyzer.service.ProjectRepository")
@patch("app.modules.ticket_analyzer.service.ConversationHistory")
@patch("app.modules.ticket_analyzer.service.LlmClient")
@pytest.mark.asyncio
async def test_escalate_direct_false_en_camino_normal(mock_llm_class, mock_history_class, mock_repo_class):
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

    assert result.escalate_direct is False
    
# verifica que la prioridad no baja si la calculada es menor a la actual
@pytest.mark.asyncio
async def test_determine_priority_no_baja_de_high_a_low():
    analyzer = TicketAnalyzer()
    analyzer.jsm_executor = MagicMock()
    analyzer.jsm_executor.update_fields = AsyncMock()

    resultado = await analyzer._determine_priority(impact="Low", urgency="Low", user_priority="High", issue_key="TEST-1")

    assert resultado == "High"
    analyzer.jsm_executor.update_fields.assert_not_called()


# verifica que la prioridad si escala cuando la calculada es mayor a la actual
@pytest.mark.asyncio
async def test_determine_priority_escala_de_low_a_highest():
    analyzer = TicketAnalyzer()
    analyzer.jsm_executor = MagicMock()
    analyzer.jsm_executor.update_fields = AsyncMock()

    resultado = await analyzer._determine_priority(impact="Critical", urgency="Critical", user_priority="Low", issue_key="TEST-1")

    assert resultado == "Highest"
    analyzer.jsm_executor.update_fields.assert_called_once()


# verifica que un cierre de conversacion no recalcula la prioridad, mantiene la actual
@patch("app.modules.ticket_analyzer.service.ProjectRepository")
@patch("app.modules.ticket_analyzer.service.ConversationHistory")
@patch("app.modules.ticket_analyzer.service.LlmClient")
@pytest.mark.asyncio
async def test_cierre_conversacion_no_recalcula_prioridad(mock_llm_class, mock_history_class, mock_repo_class):
    mock_history = MagicMock()
    mock_history.append = AsyncMock()
    mock_history.get = AsyncMock(return_value=[])
    mock_history_class.return_value = mock_history

    mock_llm = MagicMock()
    mock_llm.classify.return_value = _build_classification("L1")
    mock_llm.classify.return_value.intent = "cierre_conversacion"
    mock_llm_class.return_value = mock_llm

    mock_repo = MagicMock()
    mock_repo.get_project_context.return_value = _build_project_context()
    mock_repo_class.return_value = mock_repo

    analyzer = TicketAnalyzer()
    analyzer.jsm_executor.update_fields = AsyncMock()

    event = _build_event()
    event.priority = "High"

    result = await analyzer.analyze(event)

    assert result.priority == "High"
    analyzer.jsm_executor.update_fields.assert_not_called()