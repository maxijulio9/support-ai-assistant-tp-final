# event_pipeline
#marca como resuelta externamente una interaccion que quedo pendiente de revision
# cuando un agente resuelve el ticket directo en jsm, sin pasar por el sistema

import logging
from sqlalchemy import text
from app.core.database import get_db

logger = logging.getLogger(__name__)


class AgentResolutionRepository:

    # busca la interaccion mas reciente en needs_review para este ticket, y la marca como resuelta externamente
    # si no hay ninguna interaccion pendiente, no hace nada, no hay nada que descartar
    def discard_pending_interaction(self, issue_key: str) -> bool:
        db = next(get_db())
        try:
            row = db.execute(text("""
                SELECT i.id
                FROM interaction i
                JOIN ticket t ON i.ticket_id = t.id
                WHERE t.issue_key = :issue_key AND i.decision = 'NEEDS_REVIEW'
                ORDER BY i.created_at DESC
                LIMIT 1
            """), {"issue_key": issue_key}).fetchone()

            if row is None:
                logger.info(f"[{issue_key}] no hay interaccion pendiente de revision, nada que descartar")
                return False

            db.execute(text("""
                UPDATE interaction
                SET decision = 'RESOLVED_EXTERNALLY', reviewed_at = NOW()
                WHERE id = :id
            """), {"id": row.id})
            db.commit()

            logger.info(f"[{issue_key}] interaccion {row.id} marcada como resuelta externamente")
            return True

        except Exception as e:
            db.rollback()
            logger.error(f"[{issue_key}] error al descartar interaccion pendiente: {e}")
            raise

        finally:
            db.close()