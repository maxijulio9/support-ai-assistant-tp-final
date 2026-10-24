# M7 InternalAPI
# lee los tiempos de respuesta de los tickets, los del sistema y los de la linea base anterior a su puesta en marcha

from sqlalchemy import text
from app.core.database import get_db

# un ticket por fila, con lo que decidio el sistema en su primera interaccion con decision
# la primera respusta es la mas temprana de todas sus interacciones, y el cierre es la confirmacion del cliente que detecto el sistema
# los tickets sin hora de creacion en jsm, anteriores a que se registrara, salen igual y el servicio los cuenta sin medirlos
SYSTEM_TICKETS_QUERY = """
    WITH first_interaction AS (
        SELECT DISTINCT ON (i.ticket_id)
               i.ticket_id, i.category_id, i.system_decision, i.decision, i.resolution_channel
        FROM interaction i
        WHERE i.decision IS NOT NULL
        ORDER BY i.ticket_id, i.created_at
    ),
    ticket_times AS (
        SELECT i.ticket_id,
               MIN(i.first_response_at) AS first_response_at,
               MIN(CASE WHEN i.decision = 'RESOLVED' THEN i.resolved_at END) AS closure_at
        FROM interaction i
        GROUP BY i.ticket_id
    )
    SELECT t.jira_created_at, fi.system_decision, fi.decision, fi.resolution_channel,
           tc.name AS category, tt.first_response_at, tt.closure_at
    FROM first_interaction fi
    JOIN ticket t ON t.id = fi.ticket_id
    LEFT JOIN ticket_category tc ON tc.id = fi.category_id
    LEFT JOIN ticket_times tt ON tt.ticket_id = fi.ticket_id
    WHERE 1=1
"""

BASELINE_QUERY = """
    SELECT b.category, b.jira_created_at, b.first_response_at, b.last_customer_comment_at
    FROM ticket_response_baseline b
    WHERE 1=1
"""


class ResponseTimesRepository:

    # tickets procesados por el sistema, filtrados por proyecto, categoria y fecha de creacion en jsm
    # to_date viene excluido, el rango ya esta calculado en utc
    def list_system_tickets(self, project_id: str | None, from_date, to_date, category: str | None) -> list[dict]:
        db = next(get_db())
        try:
            query = SYSTEM_TICKETS_QUERY
            params = {}

            if project_id:
                query += " AND t.project_id = :project_id"
                params["project_id"] = project_id
            if category:
                query += " AND tc.name = :category"
                params["category"] = category
            if from_date:
                query += " AND t.jira_created_at >= :from_date"
                params["from_date"] = from_date
            if to_date:
                query += " AND t.jira_created_at < :to_date"
                params["to_date"] = to_date

            rows = db.execute(text(query), params).fetchall()

            return [
                {
                    "jira_created_at": row.jira_created_at,
                    "system_decision": row.system_decision,
                    "decision": row.decision,
                    "resolution_channel": row.resolution_channel,
                    "category": row.category,
                    "first_response_at": row.first_response_at,
                    "closure_at": row.closure_at,
                }
                for row in rows
            ]
        finally:
            db.close()

    # tickets de la linea base, filtrados solo por proyecto y categoria, es una referencia y no se filtra por fechas
    def list_baseline_tickets(self, project_id: str | None, category: str | None) -> list[dict]:
        db = next(get_db())
        try:
            query = BASELINE_QUERY
            params = {}

            if project_id:
                query += " AND b.project_id = :project_id"
                params["project_id"] = project_id
            if category:
                query += " AND b.category = :category"
                params["category"] = category

            rows = db.execute(text(query), params).fetchall()

            return [
                {
                    "category": row.category,
                    "jira_created_at": row.jira_created_at,
                    "first_response_at": row.first_response_at,
                    "last_customer_comment_at": row.last_customer_comment_at,
                }
                for row in rows
            ]
        finally:
            db.close()

    # objetivo de primera respuesta del proyecto en segundos, o none si el proyecto no existe
    def get_first_response_target(self, project_id: str) -> int | None:
        db = next(get_db())
        try:
            row = db.execute(
                text("SELECT first_response_target_seconds FROM project WHERE id = :project_id"),
                {"project_id": project_id},
            ).fetchone()

            return row.first_response_target_seconds if row else None
        finally:
            db.close()
