# M7 InternalAPI
# expone las métricas de interacciones para el dashboard

from app.modules.internal_api.repositories.interaction_metrics_repository import InteractionMetricsRepository


class InteractionMetricsService:

    def __init__(self):
        self.metrics_repository = InteractionMetricsRepository()

    # arma el resumen de metricas, opcionalmente filtrado por proyecto y rango de fechas
    def get_summary(self, project_id: str | None = None, from_date: str | None = None, to_date: str | None = None) -> dict:
        return self.metrics_repository.get_summary(project_id, from_date, to_date)

    # arma el desglose de metricas por categoria, opcionalmente filtrado por proyecto
    def get_by_category(self, project_id: str | None = None) -> list[dict]:
        return self.metrics_repository.get_by_category(project_id)