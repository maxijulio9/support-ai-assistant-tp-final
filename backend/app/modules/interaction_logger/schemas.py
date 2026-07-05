#M6 InteractionLogger
#objeto que representa un ciclo de procesamiento completo

from pydantic import BaseModel
from typing import List


class InteractionLog(BaseModel):
    # datos del ticket
    issue_key: str
    summary: str = ""
    category: str = ""
    priority: str = ""
    country: str = ""

    #para el output de M2
    intent: str = ""
    resolved_by: str = ""
    scope: str = ""
    sentiment: str = ""

    #para el output de  M4
    response_text: str = ""
    confidence_score: float = 0.0
    response_type: str = ""
    reasoning: str = ""
    missing_fields: List[str] = []

    #acciones de M5
    jsm_actions: List[str] = []