#M2: TicketAnalyze, tiene la lógica principal de análisis y clasificación de solicitudes.


import logging
from app.modules.webhook_receiver.schemas import NormalizedEvent
from app.modules.ticket_analyzer.schemas import TicketAnalysis
from app.modules.ticket_analyzer.conversation_history import ConversationHistory
from app.modules.ticket_analyzer.llm_client import LlmClient
from app.modules.ticket_analyzer.project_repository import ProjectRepository


logger = logging.getLogger(__name__)

# matriz de prioridad segun impacto y urgencia (ITIL), universal, no depende del negocio
PRIORITY_MATRIX = {
    ("Critical", "Critical"): "Highest",
    ("Critical", "High"):     "Highest",
    ("Critical", "Medium"):   "High",
    ("Critical", "Low"):      "High",

    ("High", "Critical"): "Highest",
    ("High", "High"):     "High",
    ("High", "Medium"):   "High",
    ("High", "Low"):      "Medium",

    ("Medium", "Critical"): "High",
    ("Medium", "High"):     "Medium",
    ("Medium", "Medium"):   "Medium",
    ("Medium", "Low"):      "Low",

    ("Low", "Critical"): "Medium",
    ("Low", "High"):     "Low",
    ("Low", "Medium"):   "Low",
    ("Low", "Low"):      "Low",
}


class TicketAnalyzer:

    def __init__(self):
        self.history = ConversationHistory()
        self.llm_client = LlmClient()
        self.project_repository = ProjectRepository()



    async def analyze(self, event: NormalizedEvent) -> TicketAnalysis:
        # punto de entrada, por ahora arma el objeto base con lo que llega de M1
        project_key = self._get_project_key(event.issue_key)
        project_context = self.project_repository.get_project_context(project_key)
        
        # cu9 agrega el turno nuevo del usuario al historial
        # si es comentario usa comment_body, si es ticket nuevo usa summary + description
        texto_usuario = f"{event.summary or ''} {event.description or ''}".strip()
        if event.comment_body:
            texto_usuario = event.comment_body
        if texto_usuario:
            await self.history.append(event.issue_key, "user", texto_usuario)

        # lee el historial previo de la conversacion en caso de que existan
        conversation_history = await self.history.get(event.issue_key)
        
        # cu7 clasifica el ticket usando el llm
        classification = self._classify(texto_usuario, conversation_history, project_context.categories)
        
        
        priority = self._determine_priority(
            impact=classification.impact if classification else None,
            urgency=classification.urgency if classification else None,
            user_priority=event.priority,
            issue_key=event.issue_key
        )
        
        # si el llm no pudo clasificar, asumimos que hay info suficiente
        if classification is None:
            info_sufficient = True
        else:
            info_sufficient = classification.resolved_by != "MISSING_INFO"


        return TicketAnalysis(
            issue_key=event.issue_key,
            event_type=event.event_type,
            summary=event.summary,
            country=project_context.country,
            project_id=project_context.project_id,
            threshold_auto_publish=project_context.threshold_auto_publish,
            threshold_needs_review=project_context.threshold_needs_review,
            similarity_threshold=project_context.similarity_threshold,
            priority=priority,
            intent=classification.intent if classification else None,
            category=classification.category if classification else None,
            resolved_by=classification.resolved_by if classification else None,
            scope=classification.scope if classification else None,
            sentiment=classification.sentiment if classification else None,
            conversation_history=conversation_history,
            info_sufficient=info_sufficient
        )
        


    # llm implementado, clasifica el ticket usando el llm configurado 
    def _classify(self, text: str, conversation_history: list = [], categories: list[str] = []):
        return self.llm_client.classify(text, conversation_history, categories)
    

    # si no hay clasificacion todavia, usa la prioridad del usuario, cu8
    def _determine_priority(self, impact: str, urgency: str, user_priority: str, issue_key: str) -> str:
        if not impact or not urgency:
            return user_priority or "Medium"

        calculated = self._calculate_priority(impact, urgency)

        if calculated == user_priority:
            logger.info(f"[{issue_key}] prioridad ok con la del usuario: {calculated}")
            return calculated

        logger.info(f"[{issue_key}] prioridad calculada '{calculated}' diferente a la elegida por usuario '{user_priority}'")
        # aca invocaría a m5 para aplicar la prioridad en jsm


        return calculated

    # deriva el project_key desde la nomenclatura del issue_key
    def _get_project_key(self, issue_key: str) -> str:
        return issue_key.split("-")[0] if "-" in issue_key else ""
    

    # busca la prioridad en el esquema del negocio segun category, intent
    def _calculate_priority(self, impact: str, urgency: str) -> str:
        priority = PRIORITY_MATRIX.get((impact, urgency))
        if not priority:
            logger.warning(f"combinacion ({impact}, {urgency}) no encontrada en PRIORITY_MATRIX usando Medium")
            return "Medium"
        return priority
