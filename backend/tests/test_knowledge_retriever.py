"""Tests unitarios para el modulo 3 KnowledgeRetriever
Se mockean ChunkRetriever y EmbeddingClient para controlar los chunks que devuelve la busqueda."""

from unittest.mock import patch, MagicMock
from app.modules.knowledge_retriever.service import KnowledgeRetriever
from app.modules.knowledge_retriever.schemas import RetrievedChunk
from app.modules.ticket_analyzer.schemas import TicketAnalysis


# arma un TicketAnalysis basico para usar en los tests
def _build_analysis():
    return TicketAnalysis(
        issue_key="TEST-1",
        event_type="issue_created",
        category="depositos_retiros",
        country="AR",
        summary="el deposito no se acredito en la cuenta",
    )


# verifica que has_requirements_doc da True cuando hay al menos un chunk de tipo requirements
@patch("app.modules.knowledge_retriever.service.EmbeddingClient")
@patch("app.modules.knowledge_retriever.service.ChunkRetriever")
def test_retrieve_con_chunk_de_requirements(mock_chunk_retriever_class, mock_embedding_client_class):
    mock_embedding_client = MagicMock()
    mock_embedding_client.generate_embedding.return_value = [0.1] * 1536
    mock_embedding_client_class.return_value = mock_embedding_client

    mock_chunk_retriever = MagicMock()
    mock_chunk_retriever.find_similar_chunks.return_value = [
        RetrievedChunk(chunk_id="1", content="guia de resolucion", similarity_score=0.55, doc_type="resolution"),
        RetrievedChunk(chunk_id="2", content="datos requeridos", similarity_score=0.50, doc_type="requirements"),
    ]
    mock_chunk_retriever_class.return_value = mock_chunk_retriever

    retriever = KnowledgeRetriever()
    result = retriever.retrieve(_build_analysis())

    assert result.has_requirements_doc is True
    assert len(result.chunks) == 2


# verifica que has_requirements_doc da False cuando ningun chunk es de tipo requirements
# este es el caso que antes del fix daba False sin importar los chunks reales
@patch("app.modules.knowledge_retriever.service.EmbeddingClient")
@patch("app.modules.knowledge_retriever.service.ChunkRetriever")
def test_retrieve_sin_chunk_de_requirements(mock_chunk_retriever_class, mock_embedding_client_class):
    mock_embedding_client = MagicMock()
    mock_embedding_client.generate_embedding.return_value = [0.1] * 1536
    mock_embedding_client_class.return_value = mock_embedding_client

    mock_chunk_retriever = MagicMock()
    mock_chunk_retriever.find_similar_chunks.return_value = [
        RetrievedChunk(chunk_id="1", content="guia de resolucion", similarity_score=0.55, doc_type="resolution"),
    ]
    mock_chunk_retriever_class.return_value = mock_chunk_retriever

    retriever = KnowledgeRetriever()
    result = retriever.retrieve(_build_analysis())

    assert result.has_requirements_doc is False
    assert len(result.chunks) == 1


# verifica que si el mejor score no supera el umbral, devuelve resultado vacio
# y has_requirements_doc en False, sin importar el doc_type del chunk descartado
@patch("app.modules.knowledge_retriever.service.EmbeddingClient")
@patch("app.modules.knowledge_retriever.service.ChunkRetriever")
def test_retrieve_score_insuficiente(mock_chunk_retriever_class, mock_embedding_client_class):
    mock_embedding_client = MagicMock()
    mock_embedding_client.generate_embedding.return_value = [0.1] * 1536
    mock_embedding_client_class.return_value = mock_embedding_client

    mock_chunk_retriever = MagicMock()
    mock_chunk_retriever.find_similar_chunks.return_value = [
        RetrievedChunk(chunk_id="1", content="algo poco relacionado", similarity_score=0.20, doc_type="requirements"),
    ]
    mock_chunk_retriever_class.return_value = mock_chunk_retriever

    retriever = KnowledgeRetriever()
    result = retriever.retrieve(_build_analysis())

    assert result.chunks == []
    assert result.has_requirements_doc is False
    

# verifica que usa el similarity_threshold custom del proyecto en vez del default, si viene resuelto
@patch("app.modules.knowledge_retriever.service.EmbeddingClient")
@patch("app.modules.knowledge_retriever.service.ChunkRetriever")
def test_retrieve_usa_threshold_custom_del_proyecto(mock_chunk_retriever_class, mock_embedding_client_class):
    mock_embedding_client = MagicMock()
    mock_embedding_client.generate_embedding.return_value = [0.1] * 1536
    mock_embedding_client_class.return_value = mock_embedding_client

    mock_chunk_retriever = MagicMock()
    mock_chunk_retriever.find_similar_chunks.return_value = [
        RetrievedChunk(chunk_id="1", content="algo con score medio", similarity_score=0.50, doc_type="resolution"),
    ]
    mock_chunk_retriever_class.return_value = mock_chunk_retriever

    analysis = TicketAnalysis(
        issue_key="TEST-1",
        event_type="issue_created",
        category="depositos_retiros",
        country="AR",
        summary="el deposito no se acredito en la cuenta",
        similarity_threshold=0.60,
    )

    retriever = KnowledgeRetriever()
    result = retriever.retrieve(analysis)

    # con el default 0.40 este chunk pasaria (0.50 > 0.40), pero con el threshold custom 0.60 no alcanza
    assert result.chunks == []

# verifica que cuando el proyecto tiene un space en otro idioma, tambien busca traduciendo
@patch("app.modules.knowledge_retriever.service.ProjectLanguagesRepository")
@patch("app.modules.knowledge_retriever.service.LlmClient")
@patch("app.modules.knowledge_retriever.service.EmbeddingClient")
@patch("app.modules.knowledge_retriever.service.ChunkRetriever")
def test_retrieve_busca_tambien_en_otro_idioma_si_hay_space_distinto(mock_chunk_retriever_class, mock_embedding_client_class, mock_llm_class, mock_languages_repo_class):
    mock_embedding_client = MagicMock()
    mock_embedding_client.generate_embedding.return_value = [0.1] * 1536
    mock_embedding_client_class.return_value = mock_embedding_client

    mock_llm = MagicMock()
    mock_llm.translate.return_value = "texto traducido"
    mock_llm_class.return_value = mock_llm

    mock_languages_repo = MagicMock()
    mock_languages_repo.get_space_languages.return_value = ["es", "pt"]
    mock_languages_repo_class.return_value = mock_languages_repo

    mock_chunk_retriever = MagicMock()
    mock_chunk_retriever.find_similar_chunks.return_value = [
        RetrievedChunk(chunk_id="1", content="contenido en español", similarity_score=0.60, doc_type="resolution"),
    ]
    mock_chunk_retriever_class.return_value = mock_chunk_retriever

    retriever = KnowledgeRetriever()
    analysis = _build_analysis()
    analysis.project_id = "proj-1"
    analysis.language_code = "pt"

    retriever.retrieve(analysis)

    mock_llm.translate.assert_called_once_with(analysis.summary, "es")
    assert mock_chunk_retriever.find_similar_chunks.call_count == 2


# verifica que no busca en otro idioma si no hay spaces en idiomas distintos al del ticket
@patch("app.modules.knowledge_retriever.service.ProjectLanguagesRepository")
@patch("app.modules.knowledge_retriever.service.LlmClient")
@patch("app.modules.knowledge_retriever.service.EmbeddingClient")
@patch("app.modules.knowledge_retriever.service.ChunkRetriever")
def test_retrieve_no_traduce_si_todos_los_spaces_son_del_mismo_idioma(mock_chunk_retriever_class, mock_embedding_client_class, mock_llm_class, mock_languages_repo_class):
    mock_embedding_client = MagicMock()
    mock_embedding_client.generate_embedding.return_value = [0.1] * 1536
    mock_embedding_client_class.return_value = mock_embedding_client

    mock_llm = MagicMock()
    mock_llm_class.return_value = mock_llm

    mock_languages_repo = MagicMock()
    mock_languages_repo.get_space_languages.return_value = ["es"]
    mock_languages_repo_class.return_value = mock_languages_repo

    mock_chunk_retriever = MagicMock()
    mock_chunk_retriever.find_similar_chunks.return_value = [
        RetrievedChunk(chunk_id="1", content="contenido", similarity_score=0.60, doc_type="resolution"),
    ]
    mock_chunk_retriever_class.return_value = mock_chunk_retriever

    retriever = KnowledgeRetriever()
    analysis = _build_analysis()
    analysis.project_id = "proj-1"
    analysis.language_code = "es"

    retriever.retrieve(analysis)

    mock_llm.translate.assert_not_called()
    assert mock_chunk_retriever.find_similar_chunks.call_count == 1