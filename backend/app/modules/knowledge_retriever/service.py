# M3 KnowledgeRetriever: busca los chunks mas relevantes para un ticket dado
# recibe el analisis de M2 y devuelve los fragmentos de kb mas similares
# 

import logging
from app.modules.knowledge_retriever.schemas import RetrievalResult
from app.modules.ticket_analyzer.schemas import TicketAnalysis
from app.modules.ticket_analyzer.llm_client import LlmClient
from app.modules.knowledge_retriever.chunk_retriever import ChunkRetriever
from app.modules.knowledge_retriever.project_languages_repository import ProjectLanguagesRepository
from app.modules.knowledge_indexer.embedding_client import EmbeddingClient

logger = logging.getLogger(__name__)


# umbral minimo de similitud coseno para considerar un chunk relevante
SIMILARITY_THRESHOLD = 0.4

# cuanto se suma al score si la categoria del chunk coincide con la del ticket
CATEGORY_BOOST = 0.05


class KnowledgeRetriever:

    def __init__(self):
        self.embedding_client = EmbeddingClient()
        self.chunk_retriever = ChunkRetriever()
        self.project_languages_repository = ProjectLanguagesRepository()
        self.llm_client = LlmClient()


    # punto de entrada del modulo
    # recibe el analisis de m2 y devuelve los chunks mas relevantes de la kb
    def retrieve(self, analysis: TicketAnalysis) -> RetrievalResult:
        logger.info(f"[{analysis.issue_key}] iniciando busqueda en kb")

        # arma el texto de consulta desde el ultimo turno del historial
        if analysis.conversation_history:
            query_text = analysis.conversation_history[-1].content
        else:
            query_text = analysis.summary or ""

        # busca con el idioma original del ticket
        candidates = self._search_in_language(query_text, analysis.country)

        # si hay spaces en otros idiomas para este proyecto, busca tambien traduciendo
        candidates += self._search_in_other_languages(analysis, query_text)

        # aplica el boost: suma puntos a los chunks cuya categoria coincide con la del ticket
        for chunk in candidates:
            if analysis.category and chunk.category == analysis.category:
                chunk.similarity_score += CATEGORY_BOOST

        def get_score(chunk):
            return chunk.similarity_score

        # ordena de mayor a menor por score, sin duplicar el mismo chunk si aparecio en ambas busquedas
        candidates = self._deduplicate(candidates)
        candidates.sort(key=get_score, reverse=True)
        chunks = candidates[:5]

        # si no hay chunks o el mejor no supera el umbral, no hay contexto suficiente
        threshold = analysis.similarity_threshold if analysis.similarity_threshold is not None else SIMILARITY_THRESHOLD
        if not chunks or chunks[0].similarity_score < threshold:
            logger.info(f"[{analysis.issue_key}] score insuficiente o sin resultados, devolviendo resultado vacio")
            return RetrievalResult(
                issue_key=analysis.issue_key,
                chunks=[],
                has_requirements_doc=False,
            )

        # verifica si hay al menos un chunk de tipo requirements
        has_requirements = any(c.doc_type == "requirements" for c in chunks)

        logger.info(f"[{analysis.issue_key}] chunks encontrados: {len(chunks)}, has_requirements: {has_requirements}")

        return RetrievalResult(
            issue_key=analysis.issue_key,
            chunks=chunks,
            has_requirements_doc=has_requirements,
        )

    # busca chunks con el texto tal cual, en su idioma original
    def _search_in_language(self, query_text: str, country: str | None) -> list:
        query_embedding = self.embedding_client.generate_embedding(query_text)
        return self.chunk_retriever.find_similar_chunks(query_embedding=query_embedding, country=country)

    # si el proyecto tiene spaces en idiomas distintos al del ticket, traduce y busca tambien ahi
    def _search_in_other_languages(self, analysis: TicketAnalysis, query_text: str) -> list:
        if not analysis.project_id or not analysis.language_code:
            return []

        space_languages = self.project_languages_repository.get_space_languages(analysis.project_id)
        other_languages = [lang for lang in set(space_languages) if lang != analysis.language_code]

        extra_candidates = []
        for target_language in other_languages:
            translated_text = self.llm_client.translate(query_text, target_language)
            if translated_text is None:
                logger.warning(f"[{analysis.issue_key}] no se pudo traducir a '{target_language}', se omite esa busqueda")
                continue

            translated_embedding = self.embedding_client.generate_embedding(translated_text)
            extra_candidates += self.chunk_retriever.find_similar_chunks(query_embedding=translated_embedding, country=analysis.country)

        return extra_candidates

    # saca chunks duplicados si aparecieron en mas de una busqueda, se queda con el de mayor score
    def _deduplicate(self, chunks: list) -> list:
        best_by_id = {}
        for chunk in chunks:
            existing = best_by_id.get(chunk.chunk_id)
            if existing is None or chunk.similarity_score > existing.similarity_score:
                best_by_id[chunk.chunk_id] = chunk
        return list(best_by_id.values())