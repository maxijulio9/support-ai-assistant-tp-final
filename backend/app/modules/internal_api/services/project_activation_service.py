# M7 InternalAPI: activa y desactiva proyectos
# desactivar no borra nada, el proyecto deja de procesar tickets y comentarios nuevos y todo lo anterior se conserva

import logging
from sqlalchemy import text
from app.core.database import get_db

logger = logging.getLogger(__name__)

DECISION_NEEDS_REVIEW = "NEEDS_REVIEW"


class ProjectActivationService:

    # deja el proyecto activo o desactivado y devuelve cuantas interacciones suyas siguen pendientes de revision
    # es idempotente, repetir el pedido deja el mismo resultado, y lanza ValueError si el project_key no existe
    def set_active(self, project_key: str, active: bool) -> dict:
        db = next(get_db())

        try:
            row = db.execute(
                text("UPDATE project SET is_active = :active WHERE code = :code RETURNING id"),
                {"active": active, "code": project_key},
            ).fetchone()

            if row is None:
                db.rollback()
                raise ValueError(f"project_key '{project_key}' no existe")

            pending = db.execute(
                text("""
                    SELECT COUNT(*) AS total
                    FROM interaction i
                    JOIN ticket t ON t.id = i.ticket_id
                    WHERE t.project_id = :project_id AND i.decision = :decision
                """),
                {"project_id": str(row.id), "decision": DECISION_NEEDS_REVIEW},
            ).fetchone()

            db.commit()
            return {"status": "ok", "is_active": active, "pending_reviews": pending.total}

        except ValueError:
            raise

        except Exception:
            db.rollback()
            raise

        finally:
            db.close()
