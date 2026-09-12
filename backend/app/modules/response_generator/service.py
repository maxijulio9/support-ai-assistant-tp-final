import logging
from app.modules.ticket_analyzer.schemas import TicketAnalysis
from app.modules.knowledge_retriever.schemas import RetrievalResult
from app.modules.response_generator.schemas import (
    GeneratedResponse,
    ACTION_AUTO_PUBLISH,
    ACTION_NEEDS_REVIEW,
    ACTION_REQUEST_INFO,
    ACTION_ESCALATE,
    ESCALATION_REASON_OUT_OF_SCOPE,
    ESCALATION_REASON_NO_CONTEXT,
    ESCALATION_REASON_LLM_FAILURE,
    ESCALATION_REASON_LOW_CONFIDENCE,
)
from app.modules.response_generator.prompt_builder import PromptBuilder 
from app.modules.response_generator.llm_client import LlmClient

logger = logging.getLogger(__name__)


class ResponseGenerator:
    
    def __init__(self):
        self.prompt_builder = PromptBuilder()
        self.llm_client = LlmClient()

    def generate(self, analysis: TicketAnalysis, retrieval: RetrievalResult) -> GeneratedResponse:
        logger.info(f"[{analysis.issue_key}] iniciando generacion de respuesta")

        if analysis.scope == "OUT_OF_SCOPE" or analysis.resolved_by == "L2":
            logger.info(f"[{analysis.issue_key}] escalando directo, scope={analysis.scope} resolved_by={analysis.resolved_by}")
            return GeneratedResponse(issue_key=analysis.issue_key, action_type=ACTION_ESCALATE, escalation_reason=ESCALATION_REASON_OUT_OF_SCOPE)

        if not analysis.info_sufficient:
            logger.info(f"[{analysis.issue_key}] falta informacion del usuario")
            return GeneratedResponse(issue_key=analysis.issue_key, action_type=ACTION_REQUEST_INFO)

        if not retrieval.chunks:
            logger.info(f"[{analysis.issue_key}] sin chunks relevantes en la kb, escalando")
            return GeneratedResponse(issue_key=analysis.issue_key, action_type=ACTION_ESCALATE, escalation_reason=ESCALATION_REASON_NO_CONTEXT)

        prompt = self.prompt_builder.build_prompt(analysis, retrieval)
        response_text = self.llm_client.generate_response(prompt)

        if response_text is None:
            logger.error(f"[{analysis.issue_key}] fallo la llamada al llm, escalando")
            return GeneratedResponse(issue_key=analysis.issue_key, action_type=ACTION_ESCALATE, escalation_reason=ESCALATION_REASON_LLM_FAILURE)

        confidence_prompt = self.prompt_builder.build_confidence_prompt(retrieval, response_text)
        confidence_score = self.llm_client.evaluate_confidence(confidence_prompt)
        action_type = self._evaluate_action(
            confidence_score,
            threshold_auto_publish=analysis.threshold_auto_publish,
            threshold_needs_review=analysis.threshold_needs_review,
        )

        escalation_reason = ESCALATION_REASON_LOW_CONFIDENCE if action_type in (ACTION_NEEDS_REVIEW, ACTION_ESCALATE) else None

        return GeneratedResponse(
            issue_key=analysis.issue_key,
            response_text=response_text,
            action_type=action_type,
            confidence_score=confidence_score,
            escalation_reason=escalation_reason,
        )
    
    # regenera la respuesta despues de un rechazo humano, reusa el mismo contexto
    # solo puede terminar en auto_publish o escalate, nunca en un segundo needs_review
    def regenerate(self, analysis: TicketAnalysis, retrieval: RetrievalResult, rejection_reason: str) -> GeneratedResponse:
        logger.info(f"[{analysis.issue_key}] regenerando respuesta tras rechazo, motivo: {rejection_reason}")

        prompt = self.prompt_builder.build_prompt(analysis, retrieval, rejection_reason)
        response_text = self.llm_client.generate_response(prompt)

        if response_text is None:
            logger.error(f"[{analysis.issue_key}] fallo la llamada al llm en la regeneracion, escalando")
            return GeneratedResponse(
                issue_key=analysis.issue_key,
                action_type=ACTION_ESCALATE,
                rejection_reason=rejection_reason,
                escalation_reason=ESCALATION_REASON_LLM_FAILURE,
            )

        confidence_prompt = self.prompt_builder.build_confidence_prompt(retrieval, response_text)
        confidence_score = self.llm_client.evaluate_confidence(confidence_prompt)
        action_type = self._evaluate_action(
            confidence_score,
            threshold_auto_publish=analysis.threshold_auto_publish,
            threshold_needs_review=analysis.threshold_needs_review,
        )

        if action_type == ACTION_NEEDS_REVIEW:
            logger.info(f"[{analysis.issue_key}] la respuesta regenerada sigue en revision, escala en vez de pedir otra vuelta")
            action_type = ACTION_ESCALATE

        escalation_reason = ESCALATION_REASON_LOW_CONFIDENCE if action_type == ACTION_ESCALATE else None

        return GeneratedResponse(
            issue_key=analysis.issue_key,
            response_text=response_text,
            action_type=action_type,
            confidence_score=confidence_score,
            rejection_reason=rejection_reason,
            escalation_reason=escalation_reason,
        )   
        
    # si TicketAnalysis llego sin umbrales resueltos (caso raro, deberia venir siempre completo desde M2)
    # usa los mismos defaults conservadores que ya definimos en ProjectContext
    def _evaluate_action(self, confidence_score: float, threshold_auto_publish: float | None, threshold_needs_review: float | None) -> str:
        threshold_auto_publish = threshold_auto_publish if threshold_auto_publish is not None else 0.85
        threshold_needs_review = threshold_needs_review if threshold_needs_review is not None else 0.60

        if confidence_score >= threshold_auto_publish:
            return ACTION_AUTO_PUBLISH
        if confidence_score >= threshold_needs_review:
            return ACTION_NEEDS_REVIEW
        return ACTION_ESCALATE