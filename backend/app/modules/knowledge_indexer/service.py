# M10: KnowledgeIndexer, orquesta la extraccion, limpieza y chunking de confluence

import logging
from app.modules.knowledge_indexer.client import ConfluenceClient
from app.modules.knowledge_indexer.text_cleaner import TextCleaner
from app.modules.knowledge_indexer.chunker import TextChunker
from app.modules.knowledge_indexer.schemas import ExtractedPage

logger = logging.getLogger(__name__)


class KnowledgeIndexer:

    def __init__(self):
        self.client = ConfluenceClient()
        self.cleaner = TextCleaner()
        self.chunker = TextChunker()

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
                texto_plano = self.cleaner.clean_html(html)

                pagina = ExtractedPage(
                    page_id=page_id,
                    page_title=content["title"],
                    space_key=space_key,
                    content=texto_plano,
                )
                paginas_extraidas.append(pagina)

        logger.info(f"extraccion completa, total de paginas: {len(paginas_extraidas)}")
        return paginas_extraidas