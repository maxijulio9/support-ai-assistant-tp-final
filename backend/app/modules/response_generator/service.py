import logging
from app.modules.ticket_analyzer.schemas import TicketAnalysis
from app.modules.knowledge_retriever.schemas import RetrievalResult
from app.modules.response_generator.schemas import (
    GeneratedResponse,
    ACTION_NEEDS_REVIEW,
    ACTION_REQUEST_INFO,
    ACTION_ESCALATE,
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
        
        prompt = self.prompt_builder.build_prompt(analysis, retrieval)
        response_text = self.llm_client.generate_response(prompt)

        if response_text is None:
            logger.error(f"[{analysis.issue_key}] fallo la llamada al llm, escalando")
            return GeneratedResponse(issue_key=analysis.issue_key, action_type=ACTION_ESCALATE)

        #aca se va SE envvia el action_tyupe harcod pero luego se obtiene de de _evaluate_action..
        return GeneratedResponse(
            issue_key=analysis.issue_key,
            response_text=response_text,
            action_type=ACTION_NEEDS_REVIEW,
        )
    def _evaluate_action(self, confidence_score: float) -> str:
        if confidence_score >= THRESHOLD_AUTO_PUBLISH:
            return "AUTO_PUBLISH"
        if confidence_score >= THRESHOLD_NEEDS_REVIEW:
            return ACTION_NEEDS_REVIEW
        return ACTION_ESCALATE