#Orchestrator del pipeline de procesamiento de eventos issue created y commment created.
#Coordina los módulos M2, M3, M4 y M5 según el tipo de evento recibido.


import logging
from sqlalchemy import text
from app.core.database import get_db
from app.core.jsm_status_actions import JSM_STATUS_ACTION_ESCALATE, JSM_STATUS_ACTION_AWAITING_CUSTOMER
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
    ESCALATION_REASON_LOW_CONFIDENCE,

)
from app.modules.jsm_executor.client import JsmExecutor
from app.modules.ticket_analyzer.schemas import TicketAnalysis

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

        # persiste el resultado del analisis en la bd relacional, guarda el id para completarlo despues
        interaction_id = self.interaction_logger.log_analysis(analysis)

        # si m2 ya determino que esto escala directo (out of scope o resolved_by l2),
        # nos ahorramos la consulta a m3 y la generacion de m4, que igual terminarian escalando
        if analysis.escalate_direct:
            self.interaction_logger.update_interaction_result(
                interaction_id,
                chunks_retrieved_count=0,
                generated_response=None,
                confidence_score=None,
                decision=ACTION_ESCALATE,
            )

            transition_id = await self._resolve_transition_id(event.issue_key, analysis.project_id, JSM_STATUS_ACTION_ESCALATE)
            
            if transition_id:
                try:
                    await self.jsm_executor.transition_issue(event.issue_key, transition_id)
                    logger.info(f"[{event.issue_key}] escalate_direct desde m2, transicionado en jsm")

                    acknowledgment = self.ticket_analyzer.llm_client.generate_escalation_acknowledgment(analysis.summary, None)
                    if acknowledgment:
                        await self.jsm_executor.post_comment(event.issue_key, acknowledgment, public=True)

                    internal_note = self._build_internal_escalation_note(analysis, "out_of_scope_o_l2")
                    await self.jsm_executor.post_comment(event.issue_key, internal_note, public=False)

                except Exception as e:
                    logger.error(f"[{event.issue_key}] fallo al transicionar o comentar en jsm: {e}")
                    
                    
            return {
                "status": "processed",
                "issue_key": event.issue_key,
                "analysis": analysis.model_dump(),
                "retrieved_chunks": [],
                "generated_response": {"action_type": ACTION_ESCALATE},
            }

        # busca en la kb los chunks mas relevantes segun el analisis de M2 en M3
        retrieval_result = self.knowledge_retriever.retrieve(analysis)

        #m4 genera la respuesta en base al contexto recuperado por m3 y analisis de m2
        generated_response = self.response_generator.generate(analysis, retrieval_result)

        logger.info(f"[{event.issue_key}] M4 listo, action_type={generated_response.action_type}")

        # reintenta una sola vez, solo si la razon de escalar es confianza baja
        # (out_of_scope, no_context o llm_failure no mejoran reintentando con el mismo contexto)
        # regenerate() ya limita el resultado a auto_publish o escalate, nunca un segundo needs_review
        if generated_response.escalation_reason == ESCALATION_REASON_LOW_CONFIDENCE:
            logger.info(f"[{event.issue_key}] confianza baja en el primer intento, reintentando una vez")
            generated_response = self.response_generator.regenerate(
                analysis, retrieval_result, rejection_reason="la respuesta generada no esta suficientemente respaldada por el contexto"
            )
            logger.info(f"[{event.issue_key}] reintento completo, action_type={generated_response.action_type}")
        
        # completa la interaccion con el resultado final de m3/m4
        self.interaction_logger.update_interaction_result(
            interaction_id,
            chunks_retrieved_count=len(retrieval_result.chunks),
            generated_response=generated_response.response_text,
            confidence_score=generated_response.confidence_score,
            decision=generated_response.action_type,
        )

        # persiste el detalle de cada chunk recuperado, para poder auditar el contexto real usado despues
        self.interaction_logger.save_retrieved_chunks(interaction_id, retrieval_result.chunks)
        
        # m5 ejecuta la accion segun lo que decidio m4
        # auto_publish, needs_review y request_info publican un comentario, la diferencia es si es publico o nota interna
        # escalate por ahora solo logea, la asignacion depende de m7
        if generated_response.action_type in (ACTION_AUTO_PUBLISH, ACTION_NEEDS_REVIEW, ACTION_REQUEST_INFO):
            is_public = generated_response.action_type != ACTION_NEEDS_REVIEW
            try:
                await self.jsm_executor.post_comment(event.issue_key, generated_response.response_text, public=is_public)
                logger.info(f"[{event.issue_key}] m5 publico el comentario,es public={is_public}")

                # si ya se le respondio al cliente (o se le pidio mas info), transiciona a un estado de espera
                if generated_response.action_type in (ACTION_AUTO_PUBLISH, ACTION_REQUEST_INFO):
                    transition_id = await self._resolve_transition_id(event.issue_key, analysis.project_id, JSM_STATUS_ACTION_AWAITING_CUSTOMER)
                    if transition_id:
                        await self.jsm_executor.transition_issue(event.issue_key, transition_id)
                        logger.info(f"[{event.issue_key}] transicionado a awaiting_customer en jsm")
                    else:
                        logger.warning(f"[{event.issue_key}] sin transicion configurada para awaiting_customer")

            except Exception as e:
                logger.error(f"[{event.issue_key}] fallo al publicar comentario o transicionar en jsm: {e}")

        
        elif generated_response.action_type == ACTION_ESCALATE:
            transition_id = await self._resolve_transition_id(event.issue_key, analysis.project_id, JSM_STATUS_ACTION_ESCALATE)
            if transition_id:
                try:
                    await self.jsm_executor.transition_issue(event.issue_key, transition_id)
                    logger.info(f"[{event.issue_key}] transicionado en jsm")

                    acknowledgment = self.ticket_analyzer.llm_client.generate_escalation_acknowledgment(analysis.summary, None)
                    if acknowledgment:
                        await self.jsm_executor.post_comment(event.issue_key, acknowledgment, public=True)

                    internal_note = self._build_internal_escalation_note(analysis, generated_response.escalation_reason)
                    await self.jsm_executor.post_comment(event.issue_key, internal_note, public=False)

                except Exception as e:
                    logger.error(f"[{event.issue_key}] fallo al transicionar o comentar en jsm: {e}")
            else:
                logger.warning(f"[{event.issue_key}] ticket va para escalamiento, sin transicion configurada o disponible")

        return {
            "status": "processed",
            "issue_key": event.issue_key,
            "analysis": analysis.model_dump(),
            "retrieved_chunks": [chunk.model_dump() for chunk in retrieval_result.chunks], #TEST
            "generated_response": generated_response.model_dump(),
        }
    
    # resuelve el transition_id real de jsm para una accion generica (escalate, resolve, etc)
    # busca el system_action(en jsm_status_actions)configurado para ese proyecto y lo matchea contra
    # las transiciones disponibles para ese ticket puntual en su estado actual
    async def _resolve_transition_id(self, issue_key: str, project_id: str, system_action: str) -> str | None:
        target_status_name = self._get_target_status_name(project_id, system_action)

        if target_status_name is None:
            logger.warning(f"[{issue_key}] no hay mapeo configurado para la accion '{system_action}' en este proyecto")
            return None

        transitions_data = await self.jsm_executor.get_transitions(issue_key)
        transitions = transitions_data.get("transitions", [])

        for transition in transitions:
            if transition.get("to", {}).get("name") == target_status_name:
                return transition["id"]

        logger.warning(f"[{issue_key}] no se encontro una transicion disponible hacia '{target_status_name}'")
        return None

    # busca en project_config el nombre del estado configurado para una accion, en un proyecto puntual
    def _get_target_status_name(self, project_id: str, system_action: str) -> str | None:
        db = next(get_db())
        try:
            row = db.execute(text("""
                SELECT ts.name
                FROM project_config pc
                JOIN ticket_status ts ON pc.status_id = ts.id
                WHERE pc.project_id = :project_id AND pc.system_action = :system_action AND pc.is_active = TRUE
            """), {"project_id": project_id, "system_action": system_action}).fetchone()

            return row.name if row else None
        finally:
            db.close()
    
    # arma el texto de la nota interna para el agente, resumen de lo que detecto el sistema antes de escalar
    def _build_internal_escalation_note(self, analysis: TicketAnalysis, escalation_reason: str | None) -> str:
        return (
            f"Resumen automatico del analisis:\n"
            f"Categoria: {analysis.category or 'sin clasificar'}\n"
            f"Prioridad: {analysis.priority or 'sin clasificar'}\n"
            f"Intent: {analysis.intent or 'sin clasificar'}\n"
            f"Sentimiento: {analysis.sentiment or 'sin clasificar'}\n"
            f"Motivo de escalamiento: {escalation_reason or 'no especificado'}"
        )