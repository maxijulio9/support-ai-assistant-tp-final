# M4 ResponseGenerator: define los objetos que maneja este módulo
# 

from pydantic import BaseModel
from typing import Optional

# los tres tipos de accion que puede tomar el sistema despues de generar una respuesta
ACTION_AUTO_PUBLISH = "AUTO_PUBLISH" 
ACTION_NEEDS_REVIEW = "NEEDS_REVIEW"
ACTION_REQUEST_INFO = "REQUEST_INFO" 
ACTION_ESCALATE = "ESCALATE"

# motivos posibles por los que se llega a needs_review o escalate
# distingue si tiene sentido reintentar automaticamente o no
ESCALATION_REASON_OUT_OF_SCOPE = "out_of_scope"
ESCALATION_REASON_NO_CONTEXT = "no_context"
ESCALATION_REASON_LLM_FAILURE = "llm_failure"
ESCALATION_REASON_LOW_CONFIDENCE = "low_confidence"

class GeneratedResponse(BaseModel):
    issue_key: str
    response_text: Optional[str] = None
    action_type: str
    confidence_score: Optional[float] = None
    rejection_reason: Optional[str] = None
    escalation_reason: Optional[str] = None