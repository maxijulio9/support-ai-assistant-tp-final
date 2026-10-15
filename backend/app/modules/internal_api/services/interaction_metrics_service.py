# M7 InternalAPI
# expone las métricas de interacciones para el dashboard

from app.modules.internal_api.repositories.interaction_metrics_repository import InteractionMetricsRepository
from app.modules.internal_api.metrics_period import resolve_timezone, resolve_period
from datetime import date, timedelta

# tope de dias de una serie diaria, para que un rango enorme no devuelva una respuesta gigante
MAX_DAILY_DAYS = 366

class InteractionMetricsService:

    def __init__(self):
        self.metrics_repository = InteractionMetricsRepository()

    # arma el resumen de metricas, opcionalmente filtrado por proyecto, categoria, decision y rango de fechas
    # si viene tz, from_date y to_date se leen como fechas del calendario en ese huso, ambas inclusivas
    # sin tz se mantiene lo de siempre, las fechas se comparan tal cual contra created_at
    # lanza ValueError si el huso o las fechas no son validos
    def get_summary(self, project_id: str | None = None, from_date: str | None = None, to_date: str | None = None,
                    category: str | None = None, decision: str | None = None, tz: str | None = None) -> dict:
        if tz is None:
            return self.metrics_repository.get_summary(project_id, from_date, to_date, category, decision)

        start, end = resolve_period(from_date, to_date, resolve_timezone(tz))
        return self.metrics_repository.get_summary(project_id, start, end, category, decision, to_date_exclusive=True)

    # arma el desglose de metricas por categoria, con los mismos filtros y la misma lectura de fechas que el resumen
    # lanza ValueError si el huso o las fechas no son validos
    def get_by_category(self, project_id: str | None = None, from_date: str | None = None, to_date: str | None = None,
                        category: str | None = None, decision: str | None = None, tz: str | None = None) -> list[dict]:
        if tz is None:
            return self.metrics_repository.get_by_category(project_id, from_date, to_date, category, decision)

        start, end = resolve_period(from_date, to_date, resolve_timezone(tz))
        return self.metrics_repository.get_by_category(project_id, start, end, category, decision, to_date_exclusive=True)


    # arma la serie diaria de metricas en el huso pedido, con los dias sin interacciones en cero
    # from_date y to_date son dias del calendario en ese huso y ambos son inclusivos, el huso por defecto es America/Argentina/Buenos_Aires
    # si falta alguna de las dos fechas, ese extremo es el primer o el ultimo dia con datos
    # lanza ValueError si el huso o las fechas no son validos, o si el rango supera MAX_DAILY_DAYS
    def get_daily(self, project_id: str | None = None, from_date: str | None = None, to_date: str | None = None,
                  category: str | None = None, decision: str | None = None, tz: str | None = None) -> dict:
        zone = resolve_timezone(tz)
        start, end = resolve_period(from_date, to_date, zone)
        days_with_data = self.metrics_repository.get_daily(zone, project_id, start, end, category, decision)

        first_day = date.fromisoformat(from_date) if from_date else (days_with_data[0]["date"] if days_with_data else None)
        last_day = date.fromisoformat(to_date) if to_date else (days_with_data[-1]["date"] if days_with_data else None)

        if first_day is None or last_day is None:
            return {"timezone": zone.key, "days": []}

        if (last_day - first_day).days + 1 > MAX_DAILY_DAYS:
            raise ValueError(f"el rango no puede superar {MAX_DAILY_DAYS} dias")

        by_day = {day["date"]: day for day in days_with_data}
        days = []
        current = first_day
        while current <= last_day:
            day = dict(by_day[current]) if current in by_day else self._empty_day(current)
            day["date"] = current.isoformat()
            days.append(day)
            current += timedelta(days=1)

        return {"timezone": zone.key, "days": days}

    # arma un dia sin interacciones, con todos los conteos en cero
    def _empty_day(self, day: date) -> dict:
        return {
            "date": day,
            "total_interactions": 0,
            "auto_publish_count": 0,
            "needs_review_count": 0,
            "escalate_count": 0,
            "request_info_count": 0,
            "resolved_count": 0,
            "resolved_externally_count": 0,
            "avg_confidence_score": None,
        }