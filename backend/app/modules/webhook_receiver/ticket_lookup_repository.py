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
            
    # trae los nombres de estado reales que permiten reprocesar comentarios (estado inicial o esperando cliente)
    # cualquier otro estado (escalado, resuelto, etc) significa que un humano ya esta interviniendo, no reprocesar
    def get_reprocessable_status_names(self, project_id: str) -> list[str]:
        db = next(get_db())
        try:
            rows = db.execute(text("""
                SELECT ts.name
                FROM project_config pc
                JOIN ticket_status ts ON pc.status_id = ts.id
                WHERE pc.project_id = :project_id
                  AND pc.system_action IN ('initial', 'awaiting_customer')
                  AND pc.is_active = TRUE
            """), {"project_id": project_id}).fetchall()

            return [row.name for row in rows]
        finally:
            db.close()
            
    # resuelve el project_id real a partir del project_key (prefijo del issue_key)
    def get_project_id_by_key(self, project_key: str) -> str | None:
        db = next(get_db())
        try:
            row = db.execute(text("SELECT id FROM project WHERE code = :project_key"), {"project_key": project_key}).fetchone()
            return str(row.id) if row else None
        finally:
            db.close()