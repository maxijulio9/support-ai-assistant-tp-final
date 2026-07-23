# M10 KnowledgeIndexer: define los objetos que maneja este modulo

from pydantic import BaseModel
from typing import Optional


class ExtractedPage(BaseModel):
    # representa una pagina de confluence ya extraida y limpia, lista para chunking
    page_id: str
    page_title: str
    space_key: str
    content: str
    doc_type: Optional[str] = None
    category: Optional[str] = None
    country: Optional[str] = None