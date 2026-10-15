# M7 InternalAPI
# expone las métricas de interacciones para el dashboard

from app.modules.internal_api.repositories.interaction_metrics_repository import InteractionMetricsRepository
from app.modules.internal_api.metrics_period import resolve_timezone, resolve_period


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