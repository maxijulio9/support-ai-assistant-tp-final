#M2: TicketAnalyze, tiene la lógica principal de análisis y clasificación de solicitudes.


import asyncio
import logging
from app.modules.webhook_receiver.schemas import NormalizedEvent
from app.modules.ticket_analyzer.schemas import TicketAnalysis
from app.modules.ticket_analyzer.conversation_history import ConversationHistory
from app.modules.ticket_analyzer.info_request_repository import InfoRequestRepository, MAX_INFO_REQUESTS
from app.modules.ticket_analyzer.llm_client import LlmClient
from app.modules.ticket_analyzer.attachment_reader import fetch_images
from app.modules.ticket_analyzer.project_repository import ProjectRepository
from app.modules.jsm_executor.client import JsmExecutor
from app.modules.internal_api.repositories.jsm_credentials_repository import JsmCredentialsRepository


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
        self.info_request_repository = InfoRequestRepository()
        self.llm_client = LlmClient()
        self.project_repository = ProjectRepository()
        #self.jsm_executor = JsmExecutor()
        self.credentials_repository = JsmCredentialsRepository()

    async def analyze(self, event: NormalizedEvent, jsm_executor) -> TicketAnalysis:
        # punto de entrada, por ahora arma el objeto base con lo que llega de M1
        project_key = self._get_project_key(event.issue_key)
        project_context = self.project_repository.get_project_context(project_key)
        
        # cu9 agrega el turno nuevo del usuario al historial
        # si es comentario usa comment_body, si es ticket nuevo usa summary + description
        # si el proyecto habilito el analisis de adjuntos, la descripcion suma lo que se ve en las imagenes del ticket
        description = await self._describe_attachments(event, project_context, jsm_executor)
        texto_usuario = f"{event.summary or ''} {description or ''}".strip()
        if event.comment_body:
            texto_usuario = event.comment_body
        if texto_usuario:
            await self.history.append(event.issue_key, "user", texto_usuario)

        # lee el historial previo de la conversacion en caso de que existan
        conversation_history = await self.history.get(event.issue_key)
        
        # cu7 clasifica el ticket usando el llm
        classification = self._classify(texto_usuario, conversation_history, project_context.categories)
        if classification and classification.resolved_by == "L2" and classification.scope != "OUT_OF_SCOPE" and not event.comment_body:
            verdict = await asyncio.to_thread(self.llm_client.verify_reproduction_info, texto_usuario, conversation_history)
            if verdict == "falta":
                classification.resolved_by = "MISSING_INFO"
        if classification and classification.resolved_by == "MISSING_INFO" and event.comment_body:
            info_requests = await asyncio.to_thread(self.info_request_repository.count_info_requests, event.issue_key)
            if info_requests >= MAX_INFO_REQUESTS:
                classification.resolved_by = "L2"
        
        
        # un cierre de conversacion o un mensaje sin info suficiente no tienen contenido real que evaluar, impact y urgency saldrian inventados, se mantiene la prioridad actual
        if classification and (classification.intent == "cierre_conversacion" or classification.resolved_by == "MISSING_INFO"):
            priority = event.priority or "Medium"
        else:
            priority = await self._determine_priority(
                impact=classification.impact if classification else None,
                urgency=classification.urgency if classification else None,
                user_priority=event.priority,
                issue_key=event.issue_key,
                jsm_executor=jsm_executor,
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
            description=description,
            country=project_context.country,
            project_id=project_context.project_id,
            issue_type_id=event.issue_type_id,
            threshold_auto_publish=project_context.threshold_auto_publish,
            threshold_needs_review=project_context.threshold_needs_review,
            similarity_threshold=project_context.similarity_threshold,
            language_code=project_context.language_code,
            priority=priority,
            intent=classification.intent if classification else None,
            category=classification.category if classification else None,
            resolved_by=classification.resolved_by if classification else None,
            scope=classification.scope if classification else None,
            sentiment=classification.sentiment if classification else None,
            conversation_history=conversation_history,
            info_sufficient=info_sufficient,
            status=event.status,
            request_type=event.request_type,
            reporter_account_id=event.reporter_id,
            escalate_direct=self._should_escalate_direct(classification, event) if classification else False,
        )
        


    # llm implementado, clasifica el ticket usando el llm configurado 
    def _classify(self, text: str, conversation_history: list = [], categories: list[str] = []):
        return self.llm_client.classify(text, conversation_history, categories)
    

    # si el proyecto habilito el analisis de adjuntos, lee las imagenes del ticket nuevo y suma lo que se ve a la descripcion
    # es opcional y viene apagado, ante cualquier fallo se ignora el adjunto y el ticket sigue solo con el texto
    async def _describe_attachments(self, event: NormalizedEvent, project_context, jsm_executor) -> str | None:
        if event.comment_body or not event.attachments or not project_context.analyze_attachments:
            return event.description

        try:
            images = await fetch_images(jsm_executor, event.attachments)
            if not images:
                return event.description

            seen = await asyncio.to_thread(self.llm_client.describe_images, images)
        except Exception as e:
            logger.error(f"[{event.issue_key}] fallo el analisis de los adjuntos, se sigue solo con el texto: {type(e).__name__}: {e}")
            return event.description

        if not seen:
            return event.description

        logger.info(f"[{event.issue_key}] se leyeron {len(images)} imagenes adjuntas")
        return f"{event.description or ''}\n\n[Contenido de las imagenes adjuntas]\n{seen}".strip()

    # decide si el mensaje se escala directo sin buscar en la base de conocimiento
    # un agradecimeinto o confirmacion de cierre dentro de una conversacion nunca se escala, el clasificador a veces lo marca como fuera de alcance porque no trae ninguna consulta
    # en un ticket nuevo se decide igual que antes
    def _should_escalate_direct(self, classification, event) -> bool:
        if classification.intent == "cierre_conversacion" and event.comment_body:
            return False

        return classification.scope == "OUT_OF_SCOPE" or classification.resolved_by == "L2"

    # orden de severidad de prioridad, para saber si un valor nuevo es una escalada real o no
    PRIORITY_ORDER = {"Low": 0, "Medium": 1, "High": 2, "Highest": 3}

    # solo escala la prioridad hacia arriba, nunca la baja por un mensaje aislado
    # un problema urgente sigue siendo urgente aunque un comentario puntual suene neutro
    async def _determine_priority(self, impact: str, urgency: str, user_priority: str, issue_key: str, jsm_executor) -> str:
        current_priority = user_priority or "Medium"

        if not impact or not urgency:
            return current_priority

        calculated = self._calculate_priority(impact, urgency)

        if self.PRIORITY_ORDER.get(calculated, 0) <= self.PRIORITY_ORDER.get(current_priority, 0):
            logger.info(f"[{issue_key}] prioridad calculada '{calculated}' no supera la actual '{current_priority}', se mantiene")
            return current_priority

        logger.info(f"[{issue_key}] prioridad escala de '{current_priority}' a '{calculated}'")

        try:
            await jsm_executor.update_fields(issue_key, {"priority": {"name": calculated}})
            logger.info(f"[{issue_key}] prioridad actualizada en jsm a '{calculated}'")
        except Exception as e:
            logger.error(f"[{issue_key}] error al actualizar prioridad en jsm: {e}")

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
