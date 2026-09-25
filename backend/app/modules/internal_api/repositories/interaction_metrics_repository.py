# M7 InternalAPI, agrega metricas sobre interaction para el dashboard (TF-160)

from sqlalchemy import text
from app.core.database import get_db


class InteractionMetricsRepository:

    # agregado global de interacciones, opcionalmente filtrado por proyecto y rango de fechas
    # se excluyen las filas con decision null, son datos viejos de antes de que se completara ese campo
    def get_summary(self, project_id: str | None = None, from_date: str | None = None, to_date: str | None = None) -> dict:
        db = next(get_db())
        try:
            query = """
                SELECT i.decision, i.confidence_score
                FROM interaction i
                JOIN ticket t ON i.ticket_id = t.id
                WHERE i.decision IS NOT NULL
            """
            params = {}

            if project_id:
                query += " AND t.project_id = :project_id"
                params["project_id"] = project_id
            if from_date:
                query += " AND i.created_at >= :from_date"
                params["from_date"] = from_date
            if to_date:
                query += " AND i.created_at <= :to_date"
                params["to_date"] = to_date

            rows = db.execute(text(query), params).fetchall()

            total = len(rows)
            auto_publish_count = 0
            needs_review_count = 0
            escalate_count = 0
            request_info_count = 0
            resolved_count = 0
            resolved_externally_count = 0
            confidence_scores = []

            for row in rows:
                if row.decision == "AUTO_PUBLISH":
                    auto_publish_count += 1
                elif row.decision == "NEEDS_REVIEW":
                    needs_review_count += 1
                elif row.decision == "ESCALATE":
                    escalate_count += 1
                elif row.decision == "REQUEST_INFO":
                    request_info_count += 1
                elif row.decision == "RESOLVED":
                    resolved_count += 1
                elif row.decision == "RESOLVED_EXTERNALLY":
                    resolved_externally_count += 1

                if row.confidence_score is not None:
                    confidence_scores.append(row.confidence_score)

            if total > 0:
                automatic_resolution_rate = round(auto_publish_count / total, 4)
            else:
                automatic_resolution_rate = 0.0

            if confidence_scores:
                avg_confidence_score = round(sum(confidence_scores) / len(confidence_scores), 4)
            else:
                avg_confidence_score = None

            return {
                "total_interactions": total,
                "auto_publish_count": auto_publish_count,
                "needs_review_count": needs_review_count,
                "escalate_count": escalate_count,
                "request_info_count": request_info_count,
                "resolved_count": resolved_count,
                "resolved_externally_count": resolved_externally_count,
                "automatic_resolution_rate": automatic_resolution_rate,
                "avg_confidence_score": avg_confidence_score,
            }
        finally:
            db.close()