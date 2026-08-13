import logging
from app.modules.ticket_analyzer.schemas import TicketAnalysis
from app.modules.knowledge_retriever.schemas import RetrievalResult
from app.modules.response_generator.schemas import (
    GeneratedResponse,
    ACTION_NEEDS_REVIEW,
    ACTION_REQUEST_INFO,
    ACTION_ESCALATE,
)

logger = logging.getLogger(__name__)

# luego se parametriza desde project_config cuando exista CU26 en m7
THRESHOLD_AUTO_PUBLISH = 0.85
THRESHOLD_NEEDS_REVIEW = 0.60


class ResponseGenerator:

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

        # aca va build_prompt + llamada a llm
        return GeneratedResponse(issue_key=analysis.issue_key, action_type=ACTION_NEEDS_REVIEW)

    def _evaluate_action(self, confidence_score: float) -> str:
        if confidence_score >= THRESHOLD_AUTO_PUBLISH:
            return "AUTO_PUBLISH"
        if confidence_score >= THRESHOLD_NEEDS_REVIEW:
            return ACTION_NEEDS_REVIEW
        return ACTION_ESCALATE