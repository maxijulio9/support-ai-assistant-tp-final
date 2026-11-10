# M2 TicketAnalyzer: cuenta cuantas veces el sistema ya le pidio informacion al cliente en un ticket
import logging
from sqlalchemy import text
from app.core.database import get_db

logger = logging.getLogger(__name__)

# cuantos pedidos de informacion se hacen por ticket antes de pasarlo a una persona
MAX_INFO_REQUESTS = 1


class InfoRequestRepository:

    # cuenta las interacciones del ticket que terminaron en un pedido de informacion, si falla devuelve 0 y no se aplica el tope
    def count_info_requests(self, issue_key: str) -> int:
        db = next(get_db())
        try:
            return db.execute(text("""
                SELECT COUNT(*)
                FROM interaction i
                JOIN ticket t ON i.ticket_id = t.id
                WHERE t.issue_key = :issue_key AND i.decision = 'REQUEST_INFO'
            """), {"issue_key": issue_key}).scalar() or 0
        except Exception as e:
            logger.warning(f"[{issue_key}] no se pudo contar los pedidos de informacion, no se aplica el tope: {e}")
            return 0
        finally:
            db.close()
