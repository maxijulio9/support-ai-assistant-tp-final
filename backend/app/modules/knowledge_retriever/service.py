 # M3 KnowledgeRetriever: busca los chunks mas relevantes para un ticket dado
# recibe el analisis de M2 y devuelve los fragmentos de kb mas similares
# 

import logging
from app.modules.knowledge_retriever.schemas import RetrievalResult
from app.modules.ticket_analyzer.schemas import TicketAnalysis
from app.modules.knowledge_retriever.chunk_retriever import ChunkRetriever
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


    # punto de entrada del modulo
    # recibe el analisis de m2 y devuelve los chunks mas relevantes de la kb
    def retrieve(self, analysis: TicketAnalysis) -> RetrievalResult:
        logger.info(f"[{analysis.issue_key}] iniciando busqueda en kb")

        # arma el texto de consulta desde el ultimo turno del historial
        if analysis.conversation_history:
            query_text = analysis.conversation_history[-1].content
        else:
            query_text = analysis.summary or ""

        # genera el embedding del texto del ticket
        query_embedding = self.embedding_client.generate_embedding(query_text)

        # trae mas candidatos de los que se van a devolver, sin filtrar por category
        candidates = self.chunk_retriever.find_similar_chunks(
            query_embedding=query_embedding,
            country=analysis.country,
        )


        # aplica el alg boost: suma puntos a los chunks cuya categoria coincide con la del ticket
        for chunk in candidates:
            if analysis.category and chunk.category == analysis.category:
                chunk.similarity_score += CATEGORY_BOOST

       
        def get_score(chunk):
            return chunk.similarity_score

        # ordena de mayor a menor por score
        candidates.sort(key=get_score, reverse=True)
        chunks = candidates[:5]


        # # busca los chunks mas similares con filtros opcionales
        # chunks = self.chunk_retriever.find_similar_chunks(
        #     query_embedding=query_embedding,
        #     category=analysis.category,
        #     country=analysis.country,
        # )

        # si no hay chunks o el mejor no supera el umbral, no hay contexto suficiente
        if not chunks or chunks[0].similarity_score < SIMILARITY_THRESHOLD:
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