# M7 InternalAPI, reconstruye el contexto de una interaccion vieja para poder regenerarla o revisarla
# cuando llega el approve/regenerate/escalate, el proceso original que la genero ya termino hace rato

import logging
from sqlalchemy import text
from app.core.database import get_db
from app.modules.knowledge_retriever.schemas import RetrievalResult, RetrievedChunk

logger = logging.getLogger(__name__)


class InteractionRepository:

    # busca la interaccion junto con los datos del ticket que necesita para reconstruir el contexto
    def get_interaction_context(self, interaction_id: str):
        db = next(get_db())

        try:
            interaction_row = self._fetch_interaction_with_ticket(db, interaction_id)

            if interaction_row is None:
                logger.warning(f"interaction '{interaction_id}' no encontrada")
                return None

            chunks = self._fetch_retrieval_context(db, interaction_id)
            thresholds = self._fetch_project_thresholds(db, interaction_row.project_id)

            retrieval = RetrievalResult(
                issue_key=interaction_row.issue_key,
                chunks=chunks,
            )

            return {
                "issue_key": interaction_row.issue_key,
                "project_id": str(interaction_row.project_id) if interaction_row.project_id else None,
                "generated_response": interaction_row.generated_response,
                "retrieval": retrieval,
                "threshold_auto_publish": thresholds.threshold_auto_publish if thresholds else 0.85,
                "threshold_needs_review": thresholds.threshold_needs_review if thresholds else 0.60,
            }

        finally:
            db.close()

    # busca la interaccion con join a ticket, para sacar issue_key y project_id
    def _fetch_interaction_with_ticket(self, db, interaction_id: str):
        query = text("""
            SELECT i.generated_response, t.issue_key, t.project_id
            FROM interaction i
            JOIN ticket t ON i.ticket_id = t.id
            WHERE i.id = :interaction_id
        """)
        return db.execute(query, {"interaction_id": interaction_id}).fetchone()

    # reconstruye los chunks usados en esa interaccion, con join a knowledge_chunk
    # los chunks que ya no existen (reindexados por m10) quedan afuera solos, por ser inner join
    def _fetch_retrieval_context(self, db, interaction_id: str) -> list[RetrievedChunk]:
        query = text("""
            SELECT kc.id AS chunk_id, kc.content, rc.similarity_score,
                   rc.page_title, kc.category, kc.doc_type
            FROM retrieved_chunk rc
            JOIN knowledge_chunk kc ON rc.chunk_id = kc.id
            WHERE rc.interaction_id = :interaction_id
            ORDER BY rc.rank_position
        """)
        rows = db.execute(query, {"interaction_id": interaction_id}).fetchall()

        return [
            RetrievedChunk(
                chunk_id=str(row.chunk_id),
                content=row.content,
                similarity_score=row.similarity_score,
                page_title=row.page_title,
                category=row.category,
                doc_type=row.doc_type,
            )
            for row in rows
        ]

    # trae los umbrales de decision del proyecto, si no encuentra el proyecto usa los defaults conservadores
    def _fetch_project_thresholds(self, db, project_id: str):
        if not project_id:
            return None

        query = text("""
            SELECT threshold_auto_publish, threshold_needs_review
            FROM project
            WHERE id = :project_id
        """)
        return db.execute(query, {"project_id": project_id}).fetchone()