# M4 - ResponseGenerator
# define los objetos que maneja este módulo

from pydantic import BaseModel
from typing import Optional

# los tres tipos de accion que puede tomar el sistema tras generar una respuesta
ACTION_AUTO_PUBLISH = "AUTO_PUBLISH"      # confianza alta, publica solo
ACTION_NEEDS_REVIEW = "NEEDS_REVIEW"      # confianza media, un agente revisa
ACTION_REQUEST_INFO = "REQUEST_INFO"      # falta info del usuario
ACTION_ESCALATE = "ESCALATE"             # no se puede resolver en L1

class GeneratedResponse(BaseModel):
    # objeto final que M4 produce y entrega al pipeline
    issue_key: str
    response_text: Optional[str] = None   # el texto de la respuesta generada
    action_type: str                       # uno de los cuatro ACTION_* de arriba
    confidence_score: Optional[float] = None  # score del llm entre 0 y 1
    rejection_reason: Optional[str] = None    # motivo si un agente rechazó (CU17, depende de M7)