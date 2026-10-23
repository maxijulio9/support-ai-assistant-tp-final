# M7 InternalAPI: revision humana de interacciones en NEEDS_REVIEW
# aprobar publica tal cual, regenerar reintenta con el motivo del rechazo, escalar corta directo

import logging
import uuid
from sqlalchemy import text
from app.core.database import get_db
from app.core.resolution_channels import (
    RESOLUTION_CHANNEL_REVIEWED_APPROVED,
    RESOLUTION_CHANNEL_REVIEWED_REGENERATED,
    RESOLUTION_CHANNEL_ESCALATED_BY_HUMAN,
    RESOLUTION_CHANNEL_DISCARDED_BY_HUMAN,
    RESOLUTION_CHANNEL_REVIEWED_EDITED,
)
from app.modules.internal_api.repositories.interaction_repository import InteractionRepository
from app.modules.ticket_analyzer.conversation_history import ConversationHistory
from app.modules.response_generator.service import ResponseGenerator
from app.modules.response_generator.schemas import ACTION_AUTO_PUBLISH
from app.modules.jsm_executor.client import JsmExecutor
from app.modules.internal_api.repositories.jsm_credentials_repository import JsmCredentialsRepository
from app.modules.ticket_analyzer.schemas import TicketAnalysis

logger = logging.getLogger(__name__)


DECISION_NEEDS_REVIEW = "NEEDS_REVIEW"
DECISION_DISCARDED = "DISCARDED"


# la interaccion existe pero ya no esta pendiente de revision, por ejemplo porque otra persona la aprobo o la regenero
class InteractionNotPendingError(Exception):
    pass


MAX_EDITED_RESPONSE_LENGTH = 5000


# la respuesta editada que mando el agente no es valida, esta vacia o supera el maximo de caracteres
class InvalidEditedResponseError(Exception):
    pass


class InteractionReviewService:

    def __init__(self):
        self.interaction_repository = InteractionRepository()
        self.history = ConversationHistory()
        self.response_generator = ResponseGenerator()
        #self.jsm_executor = JsmExecutor()
        self.credentials_repository = JsmCredentialsRepository()
        
    # aprueba la interaccion, publica la respuesta generada tal cual esta o la version editada por el agente
    # el texto original del sistema queda intacto en generated_response y el editado se guarda en edited_response
    async def approve_interaction(self, interaction_id: str, reviewed_by: str | None, edited_response: str | None = None) -> str:
        edited_text = self._validate_edited_response(edited_response)

        context = self.interaction_repository.get_interaction_context(interaction_id)
        if context is None:
            raise ValueError(f"interaction '{interaction_id}' no encontrada")

        jsm_executor = self._get_jsm_executor()
        response_text = context["generated_response"]
        channel = RESOLUTION_CHANNEL_REVIEWED_APPROVED

        # un texto ediatdo igual al generado se trata como una aprobacion comun
        if edited_text is not None and edited_text != (context["generated_response"] or "").strip():
            response_text = edited_text
            channel = RESOLUTION_CHANNEL_REVIEWED_EDITED
        else:
            edited_text = None

        await jsm_executor.post_comment(context["issue_key"], response_text, public=True)
        self._update_interaction(
            interaction_id,
            decision=ACTION_AUTO_PUBLISH,
            reviewed_by=reviewed_by,
            resolution_channel=channel,
            edited_response=edited_text,
            responded=True,
        )

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
            jsm_executor = self._get_jsm_executor()
            await jsm_executor.post_comment(context["issue_key"], result.response_text, public=True)
            
        self._update_interaction(
            interaction_id,
            decision=result.action_type,
            reviewed_by=reviewed_by,
            rejection_reason=rejection_reason,
            generated_response=result.response_text,
            confidence_score=result.confidence_score,
            resolution_channel=RESOLUTION_CHANNEL_REVIEWED_REGENERATED,
            responded=result.action_type == ACTION_AUTO_PUBLISH,
        )

        return result.action_type

    # escala directo, sin generar nada nuevo
    def escalate_interaction(self, interaction_id: str, rejection_reason: str | None, reviewed_by: str | None) -> str:
        context = self.interaction_repository.get_interaction_context(interaction_id)
        if context is None:
            raise ValueError(f"interaction '{interaction_id}' no encontrada")

        self._update_interaction(
            interaction_id,
            decision="ESCALATE",
            reviewed_by=reviewed_by,
            rejection_reason=rejection_reason,
            resolution_channel=RESOLUTION_CHANNEL_ESCALATED_BY_HUMAN,
        )

        return "ESCALATE"

    # descarta la sugerencia, la interaccion sale de la cola de revision sin publicar, regenerar ni escalar nada
    # es un solo UPDATE condicionado a que siga en NEEDS_REVIEW, asi dos personas no pueden resolver la misma interaccion a la vez
    def discard_interaction(self, interaction_id: str, rejection_reason: str | None, reviewed_by: str | None) -> str:
        try:
            uuid.UUID(interaction_id)
        except ValueError:
            raise ValueError(f"interaction '{interaction_id}' no encontrada")

        db = next(get_db())

        try:
            row = db.execute(
                text("""
                    UPDATE interaction
                    SET decision = :decision,
                        reviewed_by = :reviewed_by,
                        reviewed_at = NOW(),
                        rejection_reason = COALESCE(:rejection_reason, rejection_reason),
                        resolution_channel = :resolution_channel
                    WHERE id = :interaction_id AND decision = :pending_decision
                    RETURNING id
                """),
                {
                    "interaction_id": interaction_id,
                    "decision": DECISION_DISCARDED,
                    "pending_decision": DECISION_NEEDS_REVIEW,
                    "reviewed_by": reviewed_by,
                    "rejection_reason": rejection_reason,
                    "resolution_channel": RESOLUTION_CHANNEL_DISCARDED_BY_HUMAN,
                },
            ).fetchone()

            if row is None:
                exists = db.execute(
                    text("SELECT 1 FROM interaction WHERE id = :interaction_id"),
                    {"interaction_id": interaction_id},
                ).fetchone()
                db.rollback()

                if exists is None:
                    raise ValueError(f"interaction '{interaction_id}' no encontrada")
                raise InteractionNotPendingError(f"interaction '{interaction_id}' ya no esta pendiente de revision")

            db.commit()
            logger.info(f"interaction '{interaction_id}' descartada")
            return DECISION_DISCARDED

        except (ValueError, InteractionNotPendingError):
            raise

        except Exception as e:
            db.rollback()
            logger.error(f"error al descartar interaction '{interaction_id}': {e}")
            raise

        finally:
            db.close()

    # valida el texto editado por el agente, devulve el texto recortado o none si no se mando ninguno
    # lanza InvalidEditedResponseError si queda vacio o supera el maximo de caracteres
    def _validate_edited_response(self, edited_response: str | None) -> str | None:
        if edited_response is None:
            return None

        cleaned = edited_response.strip()

        if not cleaned:
            raise InvalidEditedResponseError("La respuesta editada no puede estar vacia")

        if len(cleaned) > MAX_EDITED_RESPONSE_LENGTH:
            raise InvalidEditedResponseError(f"La respuesta editada no puede superar los {MAX_EDITED_RESPONSE_LENGTH} caracteres")

        return cleaned

    # actualiza la interaccion con el resultado de la revision humana
    # system_decision no se toca nunca, queda con lo que decidio el sistema, y resolution_channel dice como se resolvio
    def _update_interaction(self, interaction_id: str, decision: str, reviewed_by: str | None,
                             rejection_reason: str | None = None, generated_response: str | None = None,
                             confidence_score: float | None = None, resolution_channel: str | None = None,
                             edited_response: str | None = None,
                             responded: bool = False):
        db = next(get_db())

        try:
            query = text("""
                UPDATE interaction
                SET decision = :decision,
                    reviewed_by = :reviewed_by,
                    reviewed_at = NOW(),
                    rejection_reason = COALESCE(:rejection_reason, rejection_reason),
                    generated_response = COALESCE(:generated_response, generated_response),
                    confidence_score = COALESCE(:confidence_score, confidence_score),
                    resolution_channel = COALESCE(:resolution_channel, resolution_channel),
                    edited_response = COALESCE(:edited_response, edited_response),
                    first_response_at = CASE WHEN :responded THEN COALESCE(first_response_at, NOW()) ELSE first_response_at END,
                    resolved_at = CASE WHEN :responded THEN COALESCE(resolved_at, NOW()) ELSE resolved_at END
                WHERE id = :interaction_id
            """)
            db.execute(query, {
                "interaction_id": interaction_id,
                "decision": decision,
                "reviewed_by": reviewed_by,
                "rejection_reason": rejection_reason,
                "generated_response": generated_response,
                "confidence_score": confidence_score,
                "resolution_channel": resolution_channel,
                "edited_response": edited_response,
                "responded": responded,
            })
            db.commit()
            logger.info(f"interaction '{interaction_id}' actualizada, decision={decision}")

        except Exception as e:
            db.rollback()
            logger.error(f"error al actualizar interaction '{interaction_id}': {e}")
            raise

        finally:
            db.close()
    
    # resuelve un jsm_executor fresco con las credenciales configuradas, lanza si todavia no hay conexion
    def _get_jsm_executor(self) -> JsmExecutor:
        credentials = self.credentials_repository.get_credentials()
        if credentials is None:
            raise ValueError("todavia no se configuro la conexion con jsm")

        return JsmExecutor(
            base_url=credentials["base_url"],
            user_email=credentials["user_email"],
            api_token=credentials["api_token"],
        )