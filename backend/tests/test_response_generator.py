"""Tests unitarios para el Modulo 4ResponseGenerator.
No requiere mocks todavia porque en service en generate no llama a nada externo por ahora"""

from app.modules.response_generator.service import ResponseGenerator
from app.modules.response_generator.schemas import (
    ACTION_ESCALATE,
    ACTION_REQUEST_INFO,
    ACTION_NEEDS_REVIEW,
    ACTION_RETRY,
)
from app.modules.ticket_analyzer.schemas import TicketAnalysis
from app.modules.knowledge_retriever.schemas import RetrievalResult, RetrievedChunk
from unittest.mock import patch, MagicMock


# generator = ResponseGenerator()


#arma un TicketAnalysis con valores por defecto del camino feliz, se puede sobreescribir cualquier campo
def _build_analysis(**overrides) -> TicketAnalysis:
    defaults = dict(
        issue_key="TEST-1",
        event_type="issue_created",
        scope="IN_SCOPE",
        resolved_by="L1",
        info_sufficient=True,
    )
    defaults.update(overrides)
    return TicketAnalysis(**defaults)


#arma un RetrievalResult con un chunk por defecto
def _build_retrieval(chunks=None) -> RetrievalResult:
    if chunks is None:
        chunks = [RetrievedChunk(chunk_id="1", content="contenido de ejemplo", similarity_score=0.5)]
    return RetrievalResult(issue_key="TEST-1", chunks=chunks)


# verifica que escala directo cuando el scope es out of scope
def test_escalates_when_out_of_scope():
    generator = ResponseGenerator()
    analysis = _build_analysis(scope="OUT_OF_SCOPE")
    result = generator.generate(analysis, _build_retrieval())
    
    assert result.action_type == ACTION_ESCALATE


#verifica que escala directo cuando resolved_by es l2
def test_escalates_when_resolved_by_l2():
    generator = ResponseGenerator()
    analysis = _build_analysis(resolved_by="L2")
    result = generator.generate(analysis, _build_retrieval())

    assert result.action_type == ACTION_ESCALATE


# verifica que pide info al usuario cuando falta informacion
def test_requests_info_when_info_not_sufficient():
    generator = ResponseGenerator()
    analysis = _build_analysis(info_sufficient=False)
    result = generator.generate(analysis, _build_retrieval())

    assert result.action_type == ACTION_REQUEST_INFO


#verifica que escala directo cuando no hay chunks relevantes en la kb
def test_escalates_when_no_chunks_found():
    generator = ResponseGenerator()
    analysis = _build_analysis()
    result = generator.generate(analysis, _build_retrieval(chunks=[]))

    assert result.action_type == ACTION_ESCALATE


# verifica que escala si el llm falla
@patch("app.modules.response_generator.service.LlmClient")
def test_escalates_when_llm_call_fails(mock_llm_class):
    mock_llm = MagicMock()
    mock_llm.check_context_sufficiency.return_value = True
    mock_llm.generate_response.return_value = None
    mock_llm_class.return_value = mock_llm

    generator = ResponseGenerator()
    analysis = _build_analysis()
    result = generator.generate(analysis, _build_retrieval())

    assert result.action_type == ACTION_ESCALATE
    


# verifica auto_publish cuando la confianza supera el umbral alto
@patch("app.modules.response_generator.service.LlmClient")
def test_auto_publish_when_confidence_is_high(mock_llm_class):
    mock_llm = MagicMock()
    mock_llm.check_context_sufficiency.return_value = True
    mock_llm.generate_response.return_value = "texto de respuesta generado"
    mock_llm.evaluate_confidence.return_value = 0.90
    mock_llm_class.return_value = mock_llm

    generator = ResponseGenerator()
    analysis = _build_analysis()
    result = generator.generate(analysis, _build_retrieval())

    assert result.action_type == "AUTO_PUBLISH"
    assert result.confidence_score == 0.90


# verifica needs_review cuando la confianza esta en el rango medio
@patch("app.modules.response_generator.service.LlmClient")
def test_needs_review_when_confidence_is_medium(mock_llm_class):
    mock_llm = MagicMock()
    mock_llm.check_context_sufficiency.return_value = True
    mock_llm.generate_response.return_value = "texto de respuesta generado"
    mock_llm.evaluate_confidence.return_value = 0.70
    mock_llm_class.return_value = mock_llm

    generator = ResponseGenerator()
    analysis = _build_analysis()
    result = generator.generate(analysis, _build_retrieval())

    assert result.action_type == ACTION_NEEDS_REVIEW
    assert result.response_text == "texto de respuesta generado"


# verifica escalate cuando la confianza es baja
@patch("app.modules.response_generator.service.LlmClient")
def test_escalates_when_confidence_is_low(mock_llm_class):
    mock_llm = MagicMock()
    mock_llm.check_context_sufficiency.return_value = True
    mock_llm.generate_response.return_value = "texto de respuesta generado"
    mock_llm.evaluate_confidence.return_value = 0.20
    mock_llm_class.return_value = mock_llm

    generator = ResponseGenerator()
    analysis = _build_analysis()
    result = generator.generate(analysis, _build_retrieval())

    assert result.action_type == ACTION_ESCALATE
    assert result.confidence_score == 0.20
    
# verifica que devuelve retry cuando el contexto no alcanza, sin llegar a generar la respuesta
@patch("app.modules.response_generator.service.LlmClient")
def test_retries_when_context_insufficient(mock_llm_class):
    mock_llm = MagicMock()
    mock_llm.check_context_sufficiency.return_value = False
    mock_llm_class.return_value = mock_llm

    generator = ResponseGenerator()
    analysis = _build_analysis()
    result = generator.generate(analysis, _build_retrieval())

    assert result.action_type == ACTION_RETRY
    mock_llm.generate_response.assert_not_called()
    
    

# verifica que usa los umbrales custom del proyecto en vez de los defaults, si vienen resueltos
@patch("app.modules.response_generator.service.LlmClient")
def test_uses_custom_thresholds_from_analysis(mock_llm_class):
    mock_llm = MagicMock()
    mock_llm.check_context_sufficiency.return_value = True
    mock_llm.generate_response.return_value = "texto de respuesta generado"
    mock_llm.evaluate_confidence.return_value = 0.75
    mock_llm_class.return_value = mock_llm

    generator = ResponseGenerator()
    # con los defaults, 0.75 caeria en NEEDS_REVIEW (entre 0.60 y 0.85)
    # con un threshold_auto_publish custom mas bajo, 0.75 deberia alcanzar para AUTO_PUBLISH
    analysis = _build_analysis(threshold_auto_publish=0.70, threshold_needs_review=0.50)
    result = generator.generate(analysis, _build_retrieval())

    assert result.action_type == "AUTO_PUBLISH"