# M4 ResponseGenerator: define los objetos que maneja este módulo
# 

from pydantic import BaseModel
from typing import Optional

# los tres tipos de accion que puede tomar el sistema despues de generar una respuesta
ACTION_AUTO_PUBLISH = "AUTO_PUBLISH" 
ACTION_NEEDS_REVIEW = "NEEDS_REVIEW"
ACTION_REQUEST_INFO = "REQUEST_INFO" 
ACTION_ESCALATE = "ESCALATE"
ACTION_RETRY = "RETRY"

class GeneratedResponse(BaseModel):
    issue_key: str
    response_text: Optional[str] = None
    action_type: str
    confidence_score: Optional[float] = None
    rejection_reason: Optional[str] = None
    