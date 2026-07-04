# M3 - KnowledgeRetriever
# define los objetos que maneja este módulo

from pydantic import BaseModel
from typing import List, Optional

# representa un fragmento recuperado de la bd vectorial
class RetrievedChunk(BaseModel):
    chunk_id: str
    content: str
    similarity_score: float
    page_title: Optional[str] = None
    category: Optional[str] = None
    # resolution = guia de resolución, requirements = datos obligatorios del usuario
    doc_type: Optional[str] = None


class RetrievalResult(BaseModel):
    # lo que M3 entrega a M4 después de la búsqueda
    issue_key: str
    chunks: List[RetrievedChunk] = []
    # indica si se encontró al menos un doc de requisitos para la categoría (CU11 paso 6)
    has_requirements_doc: bool = False