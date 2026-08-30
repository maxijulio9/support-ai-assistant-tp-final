# M7 InternalAPI: revision humana de interacciones en NEEDS_REVIEW
# aprobar publica tal cual, regenerar reintenta con el motivo del rechazo, escalar corta directo

import logging
from sqlalchemy import text
from app.core.database import get_db
from app.modules.internal_api.interaction_repository import InteractionRepository
from app.modules.ticket_analyzer.schemas import TicketAnalysis
from app.modules.ticket_analyzer.conversation_history import ConversationHistory
from app.modules.response_generator.service import ResponseGenerator
from app.modules.response_generator.schemas import ACTION_AUTO_PUBLISH
from app.modules.jsm_executor.client import JsmExecutor

logger = logging.getLogger(__name__)


class InteractionReviewService:

    def __init__(self):
        self.interaction_repository = InteractionRepository()
        self.history = ConversationHistory()
        self.response_generator = ResponseGenerator()
        self.jsm_executor = JsmExecutor()

    # aprueba la interaccion, publica la respuesta ya generada tal cual esta
    async def approve_interaction(self, interaction_id: str, reviewed_by: str | None) -> str:
        context = self.interaction_repository.get_interaction_context(interaction_id)
        if context is None:
            raise ValueError(f"interaction '{interaction_id}' no encontrada")

        await self.jsm_executor.post_comment(context["issue_key"], context["generated_response"], public=True)
        self._update_interaction(interaction_id, decision=ACTION_AUTO_PUBLISH, reviewed_by=reviewed_by)

        return ACTION_AUTO_PUBLISH

    # regenera la respuesta con el motivo del rechazo, publica si sale bien o escala si no
    async def regenerate_interaction(self, interaction_id: str, rejection_reason: str, reviewed_by: str | None) -> str:
        context = self.interaction_repository.get_interaction_context(interaction_id)
        if context is None:
            raise ValueError(f"interaction '{interaction_id}' no encontrada")

        conversation_history = await self.history.get(context["issue_key"])

        analysis = TicketAnalysis(
            issue_key=context["issue_key"],
            conversation_history=conversation_history,
            threshold_auto_publish=context["threshold_auto_publish"],
            threshold_needs_review=context["threshold_needs_review"],
        )

        result = self.response_generator.regenerate(analysis, context["retrieval"], rejection_reason)

        if result.action_type == ACTION_AUTO_PUBLISH:
            await self.jsm_executor.post_comment(context["issue_key"], result.response_text, public=True)

        self._update_interaction(
            interaction_id,
            decision=result.action_type,
            reviewed_by=reviewed_by,
            rejection_reason=rejection_reason,
            generated_response=result.response_text,
            confidence_score=result.confidence_score,
        )

        return result.action_type

    # escala directo, sin generar nada nuevo
    def escalate_interaction(self, interaction_id: str, rejection_reason: str | None, reviewed_by: str | None) -> str:
        context = self.interaction_repository.get_interaction_context(interaction_id)
        if context is None:
            raise ValueError(f"interaction '{interaction_id}' no encontrada")

        self._update_interaction(interaction_id, decision="ESCALATE", reviewed_by=reviewed_by, rejection_reason=rejection_reason)

        return "ESCALATE"

    # actualiza la interaccion con el resultado de la revision humana
    def _update_interaction(self, interaction_id: str, decision: str, reviewed_by: str | None,
                             rejection_reason: str | None = None, generated_response: str | None = None,
                             confidence_score: float | None = None):
        db = next(get_db())

        try:
            query = text("""
                UPDATE interaction
                SET decision = :decision,
                    reviewed_by = :reviewed_by,
                    reviewed_at = NOW(),
                    rejection_reason = COALESCE(:rejection_reason, rejection_reason),
                    generated_response = COALESCE(:generated_response, generated_response),
                    confidence_score = COALESCE(:confidence_score, confidence_score)
                WHERE id = :interaction_id
            """)
            db.execute(query, {
                "interaction_id": interaction_id,
                "decision": decision,
                "reviewed_by": reviewed_by,
                "rejection_reason": rejection_reason,
                "generated_response": generated_response,
                "confidence_score": confidence_score,
            })
            db.commit()
            logger.info(f"interaction '{interaction_id}' actualizada, decision={decision}")

        except Exception as e:
            db.rollback()
            logger.error(f"error al actualizar interaction '{interaction_id}': {e}")
            raise

        finally:
            db.close()