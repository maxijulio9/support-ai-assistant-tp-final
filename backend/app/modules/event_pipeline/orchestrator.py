#Orchestrator del pipeline de procesamiento de eventos issue created y commment created.
#Coordina los módulos M2, M3, M4 y M5 según el tipo de evento recibido.


import logging
from app.modules.webhook_receiver.schemas import NormalizedEvent
from app.modules.ticket_analyzer.service import TicketAnalyzer
from app.modules.interaction_logger.service import InteractionLogger
from app.modules.knowledge_retriever.service import KnowledgeRetriever
from app.modules.response_generator.service import ResponseGenerator
from app.modules.response_generator.schemas import (
    ACTION_AUTO_PUBLISH,
    ACTION_NEEDS_REVIEW,
    ACTION_REQUEST_INFO,
    ACTION_ESCALATE,
    ACTION_RETRY,
)
from app.modules.jsm_executor.client import JsmExecutor


logger = logging.getLogger(__name__)


class Orchestrator:

    # instancia los módulos que va a coordinar
    def __init__(self):
        self.ticket_analyzer = TicketAnalyzer()
        self.interaction_logger = InteractionLogger()
        self.knowledge_retriever = KnowledgeRetriever()
        self.response_generator = ResponseGenerator()
        self.jsm_executor = JsmExecutor()


    # punto de entrada del pipeline
    # ejecuta m2, m3 y m4. m5 todavia no esta cableado
    async def process_event(self, event: NormalizedEvent) -> dict:
        
        logger.info(f"[{event.issue_key}] iniciando procesamiento del evento {event.event_type}")

        #  m2 analisis y clasificaciòn del ticket
        analysis = await self.ticket_analyzer.analyze(event)

        logger.info(f"[{event.issue_key}] M2 listorti, priority={analysis.priority}, country={analysis.country}")

        # busca en la kb los chunks mas relevantes segun el analisis de M2 en M3
        retrieval_result = self.knowledge_retriever.retrieve(analysis)   

        # persiste el resultado del analisis en la bd relacional
        self.interaction_logger.log_analysis(analysis)
        
        #m4 genera la respuesta en base al contexto recuperado por m3 y analisis de m2
        generated_response = self.response_generator.generate(analysis, retrieval_result)

        logger.info(f"[{event.issue_key}] M4 listo, action_type={generated_response.action_type}")

        
        #  cuando action_type es retry, hay que volver a llamar a m3 para reintentar la recup. Todacia no esta hecho
        # y a m4 de nuevo, con un limite de reintentos.
        # por ahora solo log y se corta el flujo aca, sin ejecutar el reintento real
        if generated_response.action_type == ACTION_RETRY:
            logger.warning(f"[{event.issue_key}] contexto insuficiente, requeriria retry, no implementado todavia")


        # m5 ejecuta la accion segun lo que decidio m4
        # auto_publish, needs_review y request_info publican un comentario, la diferencia es si es publico o nota interna
        # escalate por ahora solo logea, la asignacion depende de m7
        if generated_response.action_type in (ACTION_AUTO_PUBLISH, ACTION_NEEDS_REVIEW, ACTION_REQUEST_INFO):
            is_public = generated_response.action_type != ACTION_NEEDS_REVIEW
            try:
                await self.jsm_executor.post_comment(event.issue_key, generated_response.response_text, public=is_public)
                logger.info(f"[{event.issue_key}] m5 publico el comentario,es public={is_public}")
            except Exception as e:
                logger.error(f"[{event.issue_key}] fallo al publicar comentario en jsm: {e}")

        elif generated_response.action_type == ACTION_ESCALATE:
            logger.warning(f"[{event.issue_key}] ticket va para escalamiento, sin asignacion automatica todavia")

        elif generated_response.action_type == ACTION_RETRY:
            logger.warning(f"[{event.issue_key}] contexto insuficiente, necesita retry, no implementado todavia")


        return {
            "status": "processed",
            "issue_key": event.issue_key,
            "analysis": analysis.model_dump(),
            "retrieved_chunks": [chunk.model_dump() for chunk in retrieval_result.chunks], #TEST
            "generated_response": generated_response.model_dump(),
        }