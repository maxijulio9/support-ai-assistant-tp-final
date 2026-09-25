# M7 InternalAPI
# lista interacciones paginadas para el dashboard (TF-160)

from sqlalchemy import text
from app.core.database import get_db


class InteractionListingRepository:

    # lista interacciones paginadas, con filtros opcionales, ordenadas de mas reciente a mas vieja
    def list_interactions(
        self,
        project_id: str | None = None,
        category: str | None = None,
        decision: str | None = None,
        from_date: str | None = None,
        to_date: str | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> list[dict]:
        db = next(get_db())
        try:
            query = """
                SELECT
                    i.id,
                    t.issue_key,
                    t.summary,
                    tc.name AS category,
                    tp.name AS priority,
                    i.decision,
                    i.confidence_score,
                    i.created_at
                FROM interaction i
                JOIN ticket t ON i.ticket_id = t.id
                LEFT JOIN ticket_category tc ON i.category_id = tc.id
                LEFT JOIN ticket_priority tp ON i.priority_id = tp.id
                WHERE 1=1
            """
            params = {"limit": limit, "offset": offset}

            if project_id:
                query += " AND t.project_id = :project_id"
                params["project_id"] = project_id
            if category:
                query += " AND tc.name = :category"
                params["category"] = category
            if decision:
                query += " AND i.decision = :decision"
                params["decision"] = decision
            if from_date:
                query += " AND i.created_at >= :from_date"
                params["from_date"] = from_date
            if to_date:
                query += " AND i.created_at <= :to_date"
                params["to_date"] = to_date

            query += " ORDER BY i.created_at DESC LIMIT :limit OFFSET :offset"

            rows = db.execute(text(query), params).fetchall()

            return [
                {
                    "interaction_id": str(row.id),
                    "issue_key": row.issue_key,
                    "summary": row.summary,
                    "category": row.category,
                    "priority": row.priority,
                    "decision": row.decision,
                    "confidence_score": row.confidence_score,
                    "created_at": row.created_at.isoformat() if row.created_at else None,
                }
                for row in rows
            ]
        finally:
            db.close()