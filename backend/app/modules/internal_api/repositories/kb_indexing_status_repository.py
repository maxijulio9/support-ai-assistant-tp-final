# M7 InternalAPI:
# lee el estado del ultimo trabajo de indexacion de la kb CU31

from sqlalchemy import text
from app.core.database import get_db
from app.modules.event_pipeline.indexing_status_repository import (
    STALE_AFTER_MINUTES,
    STALE_QUEUED_DETAIL,
    STALE_RUNNING_DETAIL,
)


class KbIndexingStatusRepository:

    # trae el estado de la indexacion mas reciente
    def get_latest_status(self) -> dict | None:
        db = next(get_db())
        try:
            row = db.execute(text("""
                SELECT id, space_keys, status, total_documents, documents_processed,
                       chunks_generated, error_detail, started_at, updated_at,
                       (status IN ('queued', 'running')
                        AND updated_at < NOW() - make_interval(mins => :stale_minutes)) AS is_stale
                FROM kb_indexing_status
                ORDER BY started_at DESC
                LIMIT 1
            """), {"stale_minutes": STALE_AFTER_MINUTES}).fetchone()

            if row is None:
                return None

            return {
                "id": str(row.id),
                "space_keys": list(row.space_keys),
                "status": "failed" if row.is_stale else row.status,
                "total_documents": row.total_documents,
                "documents_processed": row.documents_processed,
                "chunks_generated": row.chunks_generated,
                "error_detail": self._error_detail(row),
                "started_at": row.started_at.isoformat(),
                "updated_at": row.updated_at.isoformat(),
            }
        finally:
            db.close()


    # el detalle de la corrida, una corrida abandonada se informa como fallida, si ya tenia un error se respeta
    # si no, se explica que paso segun el estado en que quedo
    def _error_detail(self, row):
        if row.error_detail or not row.is_stale:
            return row.error_detail
        return STALE_QUEUED_DETAIL if row.status == "queued" else STALE_RUNNING_DETAIL
