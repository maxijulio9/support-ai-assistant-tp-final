import logging
from app.modules.ticket_analyzer.schemas import TicketAnalysis
from app.modules.knowledge_retriever.schemas import RetrievalResult
from app.modules.response_generator.schemas import (
    GeneratedResponse,
    ACTION_AUTO_PUBLISH,
    ACTION_NEEDS_REVIEW,
    ACTION_REQUEST_INFO,
    ACTION_ESCALATE,
    ACTION_RETRY,
)
from app.modules.response_generator.prompt_builder import PromptBuilder 
from app.modules.response_generator.llm_client import LlmClient

logger = logging.getLogger(__name__)

# luego se parametriza desde project_config cuando exisa m7
THRESHOLD_AUTO_PUBLISH = 0.85
THRESHOLD_NEEDS_REVIEW = 0.60


class ResponseGenerator:
    
    def __init__(self):
        self.prompt_builder = PromptBuilder()
        self.llm_client = LlmClient()
    def generate(self, analysis: TicketAnalysis, retrieval: RetrievalResult) -> GeneratedResponse:
        logger.info(f"[{analysis.issue_key}] iniciando generacion de respuesta")

        if analysis.scope == "OUT_OF_SCOPE" or analysis.resolved_by == "L2":
            logger.info(f"[{analysis.issue_key}] escalando directo, scope={analysis.scope} resolved_by={analysis.resolved_by}")
            return GeneratedResponse(issue_key=analysis.issue_key, action_type=ACTION_ESCALATE)

        if not analysis.info_sufficient:
            logger.info(f"[{analysis.issue_key}] falta informacion del usuario")
            return GeneratedResponse(issue_key=analysis.issue_key, action_type=ACTION_REQUEST_INFO)

        if not retrieval.chunks:
            logger.info(f"[{analysis.issue_key}] sin chunks relevantes en la kb, escalando")
            return GeneratedResponse(issue_key=analysis.issue_key, action_type=ACTION_ESCALATE)
        
        query = analysis.conversation_history[-1].content if analysis.conversation_history else analysis.summary
        sufficiency_prompt = self.prompt_builder.build_sufficiency_prompt(retrieval, query)
        is_sufficient = self.llm_client.check_context_sufficiency(sufficiency_prompt)

        if not is_sufficient:
            logger.info(f"[{analysis.issue_key}] contexto insuficiente segun chequeo previo, solicitando retry")
            return GeneratedResponse(issue_key=analysis.issue_key, action_type=ACTION_RETRY)


        prompt = self.prompt_builder.build_prompt(analysis, retrieval)
        response_text = self.llm_client.generate_response(prompt)

        if response_text is None:
            logger.error(f"[{analysis.issue_key}] fallo la llamada al llm, escalando")
            return GeneratedResponse(issue_key=analysis.issue_key, action_type=ACTION_ESCALATE)

        confidence_prompt = self.prompt_builder.build_confidence_prompt(retrieval, response_text)
        confidence_score = self.llm_client.evaluate_confidence(confidence_prompt)
        action_type = self._evaluate_action(confidence_score)
        
        return GeneratedResponse(
            issue_key=analysis.issue_key,
            response_text=response_text,
            action_type=action_type,
            confidence_score=confidence_score
        )
        
        
    def _evaluate_action(self, confidence_score: float) -> str:
        if confidence_score >= THRESHOLD_AUTO_PUBLISH:
            return ACTION_AUTO_PUBLISH
        if confidence_score >= THRESHOLD_NEEDS_REVIEW:
            return ACTION_NEEDS_REVIEW
        return ACTION_ESCALATE