#M2 TicketAnalyzer: Define los objetos que maneja este módulo."
#

from pydantic import BaseModel
from typing import Optional, List


class ConversationTurn(BaseModel):
    # un turno de la conversación: puede ser del usuario o del sistema
    role: str  # "user" | "system"
    content: str


class ClassificationResult(BaseModel):
    # lo que devuelve el LLM cuando clasifica el ticket (CU7)
    intent: str
    category: str
    resolved_by: str  
    scope: str       
    sentiment: str
    impact: str
    urgency: str


class TicketAnalysis(BaseModel):
    # objeto final que M2 produce y entrega al pipeline (CU5 y CU6)
    issue_key: str
    event_type: Optional[str] = None

    # resultado de CU7
    intent: Optional[str] = None
    category: Optional[str] = None
    resolved_by: Optional[str] = None
    scope: Optional[str] = None
    sentiment: Optional[str] = None

    # resultado de CU8
    priority: Optional[str] = None

    # si el ticket tiene info suficiente para generar respuesta
    info_sufficient: bool = True

    # metadatos que M3 necesita para filtrar chunks por país y categoría
    country: Optional[str] = None
    summary: Optional[str] = None
    
    # id del proyecto, lo necesita m4 para leer sus umbrales de decision
    project_id: Optional[str] = None
    
    # umbrales de decision del pipeline, resueltos por m2 para que m4 no consulte la bd de nuevo
    threshold_auto_publish: Optional[float] = None
    threshold_needs_review: Optional[float] = None
    similarity_threshold: Optional[float] = None

    # historial conversacional gestionado por CU9
    conversation_history: List[ConversationTurn] = []
    
    
class ProjectContext(BaseModel):
    project_id: Optional[str] = None
    country: str = "unknown"
    categories: List[str] = []
    threshold_auto_publish: float = 0.85
    threshold_needs_review: float = 0.60
    similarity_threshold: float = 0.40