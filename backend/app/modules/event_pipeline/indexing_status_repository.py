# event_pipeline, registra el progreso de un trabajo de indexacion en kb_indexing_status

import logging
from sqlalchemy import text
from app.core.database import get_db

logger = logging.getLogger(__name__)


class IndexingStatusRepository:

    # crea la fila del trabajo nuevo, en estado running, devuelve su id
    def create_job(self, space_keys: list[str]) -> str:
        db = next(get_db())
        try:
            row = db.execute(
                text("INSERT INTO kb_indexing_status (space_keys, status) VALUES (:space_keys, 'running') RETURNING id"),
                {"space_keys": space_keys},
            ).fetchone()
            db.commit()
            return row.id
        finally:
            db.close()

    # marca el trabajo como completado
    def mark_completed(self, job_id: str):
        db = next(get_db())
        try:
            db.execute(
                text("UPDATE kb_indexing_status SET status = 'completed', updated_at = NOW() WHERE id = :id"),
                {"id": job_id},
            )
            db.commit()
        finally:
            db.close()

    # marca el trabajo como fallido, con el detalle del error
    def mark_failed(self, job_id: str, error_detail: str):
        db = next(get_db())
        try:
            db.execute(
                text("UPDATE kb_indexing_status SET status = 'failed', error_detail = :error_detail, updated_at = NOW() WHERE id = :id"),
                {"id": job_id, "error_detail": error_detail},
            )
            db.commit()
        finally:
            db.close()