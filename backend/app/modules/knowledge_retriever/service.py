 # M3 KnowledgeRetriever: busca los chunks mas relevantes para un ticket dado
# recibe el analisis de M2 y devuelve los fragmentos de kb mas similares
# 

import logging
from app.modules.knowledge_retriever.schemas import RetrievalResult
from app.modules.ticket_analyzer.schemas import TicketAnalysis

logger = logging.getLogger(__name__)

class KnowledgeRetriever:

    # punto de entrada del modulo
    # recibe el analisis de m2 y devuelve los chunks mas relevantes de la kb
    def retrieve(self, analysis: TicketAnalysis) -> RetrievalResult:
        logger.info(f"[{analysis.issue_key}] iniciando busqueda en kb")

        # por ahora devuelve resultado vacio
        # se completa cuando se integre ChunkRetriever y EmbeddingClient
        return RetrievalResult(
            issue_key=analysis.issue_key,
            chunks=[],
            has_requirements_doc=False,
        )