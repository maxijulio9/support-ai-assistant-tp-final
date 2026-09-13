# M1 WebhookReceiverr 
# esuelve datos del ticket ya guardados en la bd, para distinguir customer de agente

from sqlalchemy import text
from app.core.database import get_db


class TicketLookupRepository:

    # trae el reporter_account_id de un ticket ya guardado, o none si el ticket no existe todavia
    def get_reporter_account_id(self, issue_key: str) -> str | None:
        db = next(get_db())
        try:
            row = db.execute(text("SELECT reporter_account_id FROM ticket WHERE issue_key = :issue_key"), {"issue_key": issue_key}).fetchone()
            return row.reporter_account_id if row else None
        finally:
            db.close()