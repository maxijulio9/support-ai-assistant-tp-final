"""Tests unitarios para el Modulo 4ResponseGenerator.
No requiere mocks todavia porque en service en generate no llama a nada externo por ahora"""

from app.modules.response_generator.service import ResponseGenerator
from app.modules.response_generator.schemas import (
    ACTION_ESCALATE,
    ACTION_REQUEST_INFO,
    ACTION_NEEDS_REVIEW,
)
from app.modules.ticket_analyzer.schemas import TicketAnalysis
from app.modules.knowledge_retriever.schemas import RetrievalResult, RetrievedChunk

generator = ResponseGenerator()


# arma un TicketAnalysis con valores por defecto del camino feliz, se puede sobreescribir cualquier campo
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


# arma un RetrievalResult con un chunk por defecto, se puede pasar una lista distinta
def _build_retrieval(chunks=None) -> RetrievalResult:
    if chunks is None:
        chunks = [RetrievedChunk(chunk_id="1", content="contenido de ejemplo", similarity_score=0.5)]
    return RetrievalResult(issue_key="TEST-1", chunks=chunks)


# verifica que escala directo cuando el scope es out of scope
def test_escalates_when_out_of_scope():
    analysis = _build_analysis(scope="OUT_OF_SCOPE")
    result = generator.generate(analysis, _build_retrieval())

    assert result.action_type == ACTION_ESCALATE


# verifica que escala directo cuando resolved_by es l2
def test_escalates_when_resolved_by_l2():
    analysis = _build_analysis(resolved_by="L2")
    result = generator.generate(analysis, _build_retrieval())

    assert result.action_type == ACTION_ESCALATE


# verifica que pide info al usuario cuando falta informacion
def test_requests_info_when_info_not_sufficient():
    analysis = _build_analysis(info_sufficient=False)
    result = generator.generate(analysis, _build_retrieval())

    assert result.action_type == ACTION_REQUEST_INFO


# verifica que escala directo cuando no hay chunks relevantes en la kb
def test_escalates_when_no_chunks_found():
    analysis = _build_analysis()
    result = generator.generate(analysis, _build_retrieval(chunks=[]))

    assert result.action_type == ACTION_ESCALATE


# verifica el camino feliz, hoy devuelve needs_review como placeholder hasta tf-63
def test_returns_needs_review_placeholder_when_all_checks_pass():
    analysis = _build_analysis()
    result = generator.generate(analysis, _build_retrieval())

    assert result.action_type == ACTION_NEEDS_REVIEW