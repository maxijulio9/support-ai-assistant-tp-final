# M7 InternalAPI, agrega metricas sobre interaction para el dashboard 
from datetime import datetime
from zoneinfo import ZoneInfo
from sqlalchemy import text
from app.core.database import get_db


class InteractionMetricsRepository:

    # agregado global de interacciones, opcionalmente filtrado por proyecto, categoria, decision y rango de fechas
    # las filas con decision null no se suman al total ni a ningun conteo, son datos viejos de antes de que se completara ese campo
    # se informan aparte en without_decision_count
    # to_date_exclusive en True deja afuera el to_date, se usa cuando el rango ya viene calculado en utc
    def get_summary(self, project_id: str | None = None, from_date: str | datetime | None = None,
                    to_date: str | datetime | None = None, category: str | None = None,
                    decision: str | None = None, to_date_exclusive: bool = False) -> dict:
        db = next(get_db())
        try:
            query = """
                SELECT i.decision, i.confidence_score, i.resolution_channel
                FROM interaction i
                JOIN ticket t ON i.ticket_id = t.id
            """
            # el join con la categoria solo se agrega si se filtra por ella, para no cambiar la consulta de antes
            if category:
                query += " LEFT JOIN ticket_category tc ON i.category_id = tc.id"
            query += " WHERE 1=1"
            params = {}

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
                operator = "<" if to_date_exclusive else "<="
                query += f" AND i.created_at {operator} :to_date"
                params["to_date"] = to_date

            rows = db.execute(text(query), params).fetchall()

            without_decision_count = 0
            auto_publish_count = 0
            needs_review_count = 0
            escalate_count = 0
            request_info_count = 0
            resolved_count = 0
            resolved_externally_count = 0
            confidence_scores = []
            channel_counts = {}

            for row in rows:
                # las filas sin decision no entran en el total ni en los conteos, solo se cuentan aparte
                if row.decision is None:
                    without_decision_count += 1
                    continue

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

                # el canal null reune las interacciones sin resolver y las anteriores a que se registrara el canal
                channel_counts[row.resolution_channel] = channel_counts.get(row.resolution_channel, 0) + 1

            total = len(rows) - without_decision_count

            if total > 0:
                automatic_resolution_rate = round(auto_publish_count / total, 4)
            else:
                automatic_resolution_rate = 0.0

            if confidence_scores:
                avg_confidence_score = round(sum(confidence_scores) / len(confidence_scores), 4)
            else:
                avg_confidence_score = None

            by_resolution_channel = []
            for channel, count in channel_counts.items():
                by_resolution_channel.append({"resolution_channel": channel, "count": count})
            # mayor cantidad primero, y a igual cantidad el canal con nombre antes que el null y por orden alfabetico, asi el orden no cambia entre llamadas
            by_resolution_channel.sort(key=lambda r: (-r["count"], r["resolution_channel"] is None, r["resolution_channel"] or ""))

            return {
                "total_interactions": total,
                "auto_publish_count": auto_publish_count,
                "needs_review_count": needs_review_count,
                "escalate_count": escalate_count,
                "request_info_count": request_info_count,
                "resolved_count": resolved_count,
                "resolved_externally_count": resolved_externally_count,
                "without_decision_count": without_decision_count,
                "automatic_resolution_rate": automatic_resolution_rate,
                "avg_confidence_score": avg_confidence_score,
                "by_resolution_channel": by_resolution_channel,
            }
        finally:
            db.close()
            
    # desglosa la tasa de resolucion automatica y la confianza media por categoria, para ver en que temas el sistema resuelve mejor
    # acepta los mismos filtros que el resumen, se excluyen las interacciones sin decision y las que no tienen categoria
    def get_by_category(self, project_id: str | None = None, from_date: str | datetime | None = None,
                        to_date: str | datetime | None = None, category: str | None = None,
                        decision: str | None = None, to_date_exclusive: bool = False) -> list[dict]:
        db = next(get_db())
        try:
            query = """
                SELECT tc.name AS category, i.decision, i.confidence_score
                FROM interaction i
                JOIN ticket t ON i.ticket_id = t.id
                JOIN ticket_category tc ON i.category_id = tc.id
                WHERE i.decision IS NOT NULL
            """
            params = {}

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
                operator = "<" if to_date_exclusive else "<="
                query += f" AND i.created_at {operator} :to_date"
                params["to_date"] = to_date

            rows = db.execute(text(query), params).fetchall()

            totals_by_category = {}
            auto_publish_by_category = {}
            confidence_sum_by_category = {}
            confidence_count_by_category = {}

            for row in rows:
                category_name = row.category
                totals_by_category[category_name] = totals_by_category.get(category_name, 0) + 1
                if row.decision == "AUTO_PUBLISH":
                    auto_publish_by_category[category_name] = auto_publish_by_category.get(category_name, 0) + 1
                if row.confidence_score is not None:
                    confidence_sum_by_category[category_name] = confidence_sum_by_category.get(category_name, 0) + row.confidence_score
                    confidence_count_by_category[category_name] = confidence_count_by_category.get(category_name, 0) + 1

            result = []
            for category_name, total in totals_by_category.items():
                auto_publish = auto_publish_by_category.get(category_name, 0)
                scored = confidence_count_by_category.get(category_name, 0)
                if scored > 0:
                    avg_confidence_score = round(confidence_sum_by_category[category_name] / scored, 4)
                else:
                    avg_confidence_score = None

                result.append({
                    "category": category_name,
                    "total_interactions": total,
                    "auto_publish_count": auto_publish,
                    "automatic_resolution_rate": round(auto_publish / total, 4),
                    "avg_confidence_score": avg_confidence_score,
                })

            result.sort(key=lambda r: r["total_interactions"], reverse=True)
            return result
        finally:
            db.close()
    
    # cuenta las interacciones por dia del calendario en el huso indicado, con los conteos por decision y la confianza media del dia
    # solo devuelve los dias que tienen interacciones, el servicio completa los dias vacios
    # el rango ya viene calculado en utc, con el fin excluido, y se excluyen las interacciones sin decision
    def get_daily(self, tz: ZoneInfo, project_id: str | None = None, from_date: datetime | None = None,
                  to_date: datetime | None = None, category: str | None = None, decision: str | None = None) -> list[dict]:
        db = next(get_db())
        try:
            query = """
                SELECT i.created_at, i.decision, i.confidence_score
                FROM interaction i
                JOIN ticket t ON i.ticket_id = t.id
                LEFT JOIN ticket_category tc ON i.category_id = tc.id
                WHERE i.decision IS NOT NULL
            """
            params = {}

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
                query += " AND i.created_at < :to_date"
                params["to_date"] = to_date

            rows = db.execute(text(query), params).fetchall()

            count_fields = {
                "AUTO_PUBLISH": "auto_publish_count",
                "NEEDS_REVIEW": "needs_review_count",
                "ESCALATE": "escalate_count",
                "REQUEST_INFO": "request_info_count",
                "RESOLVED": "resolved_count",
                "RESOLVED_EXTERNALLY": "resolved_externally_count",
            }
            days = {}
            scores_by_day = {}

            for row in rows:
                day = row.created_at.astimezone(tz).date()

                if day not in days:
                    days[day] = {
                        "date": day,
                        "total_interactions": 0,
                        "auto_publish_count": 0,
                        "needs_review_count": 0,
                        "escalate_count": 0,
                        "request_info_count": 0,
                        "resolved_count": 0,
                        "resolved_externally_count": 0,
                    }
                    scores_by_day[day] = []

                days[day]["total_interactions"] += 1
                if row.decision in count_fields:
                    days[day][count_fields[row.decision]] += 1
                if row.confidence_score is not None:
                    scores_by_day[day].append(row.confidence_score)

            result = []
            for day in sorted(days):
                scores = scores_by_day[day]
                if scores:
                    days[day]["avg_confidence_score"] = round(sum(scores) / len(scores), 4)
                else:
                    days[day]["avg_confidence_score"] = None
                result.append(days[day])

            return result
        finally:
            db.close()