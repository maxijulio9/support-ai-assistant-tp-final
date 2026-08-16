"""Tests unitarios para el m4 PromptBuilder.
No requiere mocks porque build_prompt y build_confidence_prompt no tocan nada externo, solo arman strings"""

from app.modules.response_generator.prompt_builder import PromptBuilder
from app.modules.ticket_analyzer.schemas import TicketAnalysis, ConversationTurn
from app.modules.knowledge_retriever.schemas import RetrievalResult, RetrievedChunk

builder = PromptBuilder()


def _build_analysis(**overrides) -> TicketAnalysis:
    defaults = dict(issue_key="TEST-1", event_type="issue_created")
    defaults.update(overrides)
    return TicketAnalysis(**defaults)


# verifica que el chunk recuperado aparezca en el texto final del prompt
def test_prompt_includes_chunk_content():
    analysis = _build_analysis(conversation_history=[ConversationTurn(role="user", content="no puedo iniciar sesion")])
    retrieval = RetrievalResult(issue_key="TEST-1", chunks=[
        RetrievedChunk(chunk_id="1", content="reiniciar la contrasena desde el portal", similarity_score=0.5)
    ])

    prompt = builder.build_prompt(analysis, retrieval)

    assert "reiniciar la contrasena desde el portal" in prompt


# verifica que el historial conversacional aparezca en el texto final del prompt
def test_prompt_includes_conversation_history():
    analysis = _build_analysis(conversation_history=[ConversationTurn(role="user", content="no puedo iniciar sesion")])
    retrieval = RetrievalResult(issue_key="TEST-1", chunks=[
        RetrievedChunk(chunk_id="1", content="algun contenido", similarity_score=0.5)
    ])

    prompt = builder.build_prompt(analysis, retrieval)

    assert "no puedo iniciar sesion" in prompt


# verifica que no rompa cuando no hay chunks, y avise que no hay contexto
def test_prompt_handles_no_chunks():
    analysis = _build_analysis(conversation_history=[ConversationTurn(role="user", content="consulta generica")])
    retrieval = RetrievalResult(issue_key="TEST-1", chunks=[])

    prompt = builder.build_prompt(analysis, retrieval)

    assert "sin contexto disponible" in prompt


# verifica que no rompa cuando no hay historial previo
def test_prompt_handles_no_history():
    analysis = _build_analysis(conversation_history=[])
    retrieval = RetrievalResult(issue_key="TEST-1", chunks=[
        RetrievedChunk(chunk_id="1", content="algun contenido", similarity_score=0.5)
    ])

    prompt = builder.build_prompt(analysis, retrieval)

    assert "sin historial previo" in prompt


# verifica que los chunks queden numerados en el orden en que vienen en la lista
def test_prompt_numbers_chunks_in_order():
    analysis = _build_analysis(conversation_history=[ConversationTurn(role="user", content="consulta")])
    retrieval = RetrievalResult(issue_key="TEST-1", chunks=[
        RetrievedChunk(chunk_id="1", content="primer chunk", similarity_score=0.6),
        RetrievedChunk(chunk_id="2", content="segundo chunk", similarity_score=0.5),
    ])

    prompt = builder.build_prompt(analysis, retrieval)

    assert "[1] primer chunk" in prompt
    assert "[2] segundo chunk" in prompt


# verifica que build_confidence_prompt arma el prompt con el chunk y la respuesta
def test_build_confidence_prompt_includes_context_and_response():
    retrieval = RetrievalResult(issue_key="TEST-1", chunks=[
        RetrievedChunk(chunk_id="1", content="contenido del chunk", similarity_score=0.5)
    ])
    prompt = builder.build_confidence_prompt(retrieval, "una respuesta cualquiera")

    assert "contenido del chunk" in prompt
    assert "una respuesta cualquiera" in prompt