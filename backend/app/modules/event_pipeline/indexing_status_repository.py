# event_pipeline, registra el progreso de un trabajo de indexacion en kb_indexing_status

import logging
from sqlalchemy import create_engine, text
from app.core.config import settings
from app.core.database import get_db

logger = logging.getLogger(__name__)

_progress_engine = None


# motor aparte, con una sola conexion en autocommit, para escribir el progreso con un solo viaje a la base por actualizacion
# el progreso es de mejor esfurzo: si una actualizacion falla, la corrida sigue igual
def _get_progress_engine():
    global _progress_engine
    if _progress_engine is None:
        _progress_engine = create_engine(
            settings.database_url, pool_size=1, max_overflow=0, isolation_level="AUTOCOMMIT", pool_recycle=300,
        )
    return _progress_engine


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

    # crea la fila de un trabajo que todavia no tomo el worker, en estado queued
    # devuelve el id y el started_at, que es el momento del pedido
    def create_queued_job(self, space_keys: list[str]) -> dict:
        db = next(get_db())
        try:
            row = db.execute(
                text("INSERT INTO kb_indexing_status (space_keys, status) VALUES (:space_keys, 'queued') RETURNING id, started_at"),
                {"space_keys": space_keys},
            ).fetchone()
            db.commit()
            return {"id": str(row.id), "started_at": row.started_at.isoformat()}
        finally:
            db.close()

    # el worker tomo el trabajo, lo pasa a running y reinicia el progreso
    # si el trabajo se vuelve a ejecutar porque el worker se corto, reutiliza la misma fila y no queda una corrida huerfana
    def mark_running(self, job_id: str):
        db = next(get_db())
        try:
            db.execute(
                text("""
                    UPDATE kb_indexing_status
                    SET status = 'running', total_documents = NULL, documents_processed = 0,
                        chunks_generated = 0, error_detail = NULL, updated_at = NOW()
                    WHERE id = :id
                """),
                {"id": job_id},
            )
            db.commit()
        finally:
            db.close()

    # actualiza el progreso de una corrida en curso, solo escribe los valores que vienen y refresca updated_at
    # solo toca filas en running, asi una actualizacion tardia no pisa una corrida que ya termino o fallo
    # reintenta una vez, porque la conexion aparte puede haberse cerrado mientras estaba ociosa
    def update_progress(self, job_id: str, total_documents: int | None = None,
                        documents_processed: int | None = None, chunks_generated: int | None = None):
        query = text("""
            UPDATE kb_indexing_status
            SET total_documents = COALESCE(:total_documents, total_documents),
                documents_processed = COALESCE(:documents_processed, documents_processed),
                chunks_generated = COALESCE(:chunks_generated, chunks_generated),
                updated_at = NOW()
            WHERE id = :id AND status = 'running'
        """)
        params = {
            "id": job_id,
            "total_documents": total_documents,
            "documents_processed": documents_processed,
            "chunks_generated": chunks_generated,
        }

        for attempt in range(2):
            try:
                with _get_progress_engine().connect() as conn:
                    conn.execute(query, params)
                return
            except Exception:
                if attempt == 1:
                    raise

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
