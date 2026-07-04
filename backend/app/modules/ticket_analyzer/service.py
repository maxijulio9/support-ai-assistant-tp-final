#M2: TicketAnalyze, tiene la lógica principal de análisis y clasificación de solicitudes.


import logging
from app.modules.webhook_receiver.schemas import NormalizedEvent
from app.modules.ticket_analyzer.schemas import TicketAnalysis

logger = logging.getLogger(__name__)


class TicketAnalyzer:

    def analyze(self, event: NormalizedEvent) -> TicketAnalysis:
        # punto de entrada, por ahora arma el objeto base con lo que llega de M1
        priority = self._determine_priority(event.priority)

        return TicketAnalysis(
            issue_key=event.issue_key,
            event_type=event.event_type,
            priority=priority,
            summary=event.summary,
        )

    #pendiente de implementar la logica de clasificacion, por ahora devuelve un diccionario sin nada
    def _classify(self, text: str) -> dict:

        return {}

    def _determine_priority(self, user_priority: str = None) -> str:
        # usa la prioridad del ticket por ahora
        # cuando esté CU27 completo, consulta project_priority en BD
        return user_priority or "Medium"