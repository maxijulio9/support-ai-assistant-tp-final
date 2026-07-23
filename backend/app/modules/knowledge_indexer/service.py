# M10: KnowledgeIndexer, extrae contenido de confluence, lo limpia y lo prepara para indexar

import logging
from bs4 import BeautifulSoup 
from app.modules.knowledge_indexer.client import ConfluenceClient
from app.modules.knowledge_indexer.schemas import ExtractedPage

logger = logging.getLogger(__name__)


class KnowledgeIndexer:

    def __init__(self):
        self.client = ConfluenceClient()

    # recorre todos los spaces indicados y extrae el contenido de cada pagina
    def extract_pages(self, space_keys: list[str]) -> list[ExtractedPage]:
        paginas_extraidas = []

        for space_key in space_keys:
            logger.info(f"extrayendo paginas del space {space_key}")
            pages = self.client.get_pages_from_space(space_key)

            for page in pages:
                page_id = page["id"]
                content = self.client.get_page_content(page_id)

                html = content["body"]["storage"]["value"]
                texto_plano = self._clean_html(html)

                pagina = ExtractedPage(
                    page_id=page_id,
                    page_title=content["title"],
                    space_key=space_key,
                    content=texto_plano,
                )
                paginas_extraidas.append(pagina)

        logger.info(f"extraccion completa, total de paginas: {len(paginas_extraidas)}")
        return paginas_extraidas

    # convierte el html de confluence a texto plano legible
    def _clean_html(self, html: str) -> str:
        soup = BeautifulSoup(html, "html.parser")
        
        texto = soup.get_text(separator=" ", strip=True)
        # colapsa espacios multiples en uno solo
        texto = " ".join(texto.split())
        # texto = soup.get_text(separator="\n", strip=True)
        
        return texto