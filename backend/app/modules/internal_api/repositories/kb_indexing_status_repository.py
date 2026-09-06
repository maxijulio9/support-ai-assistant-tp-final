# M7 InternalAPI:
# lee el estado del ultimo trabajo de indexacion de la kb CU31

from sqlalchemy import text
from app.core.database import get_db


class KbIndexingStatusRepository:

    # trae el estado de la indexacion mas reciente
    def get_latest_status(self) -> dict | None:
        db = next(get_db())
        try:
            row = db.execute(text("""
                SELECT space_keys, status, total_documents, documents_processed,
                       chunks_generated, error_detail, started_at, updated_at
                FROM kb_indexing_status
                ORDER BY started_at DESC
                LIMIT 1
            """)).fetchone()

            if row is None:
                return None

            return {
                "space_keys": list(row.space_keys),
                "status": row.status,
                "total_documents": row.total_documents,
                "documents_processed": row.documents_processed,
                "chunks_generated": row.chunks_generated,
                "error_detail": row.error_detail,
                "started_at": row.started_at.isoformat(),
                "updated_at": row.updated_at.isoformat(),
            }
        finally:
            db.close()